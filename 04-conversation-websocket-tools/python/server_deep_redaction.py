"""Deep-redaction demo client (PHO-3540).

A variant of server.py showing the client side of deep redaction. When a websocket tool returns a
sensitive value, the client:

  1. fills the LLM-authored `post_tool_text` template (carried in the tool-call args) with a
     same-shape DUMMY result and returns THAT as the tool output, tagged `redacted=True`, so the
     logged pipeline (echo recording, phonic-api DB) speaks/stores the dummy;
  2. fills the same template with the REAL result and sends it as a `real_sentence` message to the
     switcher-controller, which forwards it to the no-log no-trace-tts app and splices the real audio
     into the live call.

So the caller hears the real value while nothing sensitive is ever logged. The real value never
leaves this client except on the no-trace path.

The `phonic` SDK doesn't model these fields, so we hack the raw websocket:
  - `ToolCallOutputPayload` allows extra fields (pydantic extra="allow"), so `redacted=True` rides
    the normal `send_tool_call_output`;
  - `socket._send({...})` sends a raw `real_sentence` frame the SDK has no method for.

Wiring (deploy): the SDK connection must target the switcher-controller's ws URL (not phonic-api
directly) so the switcher can intercept `real_sentence` and swap the audio; and phonic-api must pass
the `redacted` flag through on the tool output to echo (PHO-3539 follow-up). Draft; not to be merged.
"""

import argparse
import asyncio
import os
import random
import re

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Response, WebSocket
from phonic import AsyncPhonic, AudioChunkPayload, ToolCallOutputPayload, ToolCallPayload
from phonic.conversations.socket_client import ConversationsSocketClientResponse
from phonic.environment import PhonicEnvironment
from phonic.types.config_payload import ConfigPayload
from twilio.twiml.voice_response import Connect, VoiceResponse

load_dotenv(".env.local")

app = FastAPI()

# Route the STS websocket through the switcher-controller (which relays to phonic-api and splices the
# no-trace audio) instead of connecting to phonic-api directly. The SDK targets <production>/v1/sts/ws,
# which the switcher answers. REST base is unchanged (this client only uses the websocket).
SWITCHER_WS_BASE = os.getenv("SWITCHER_WS_BASE", "wss://phonic-co-dev--echo-switcher-switcher-app.us-east.modal.run")
client = AsyncPhonic(
    api_key=os.getenv("PHONIC_API_KEY"),
    environment=PhonicEnvironment(base=PhonicEnvironment.DEFAULT.base, production=SWITCHER_WS_BASE),
)

OUTPUT_FORMAT = "mulaw_8000"  # Twilio media stream format; must match phonic-api + no-trace-tts.
AGENT_VOICE = "sabrina"  # must match the agent's voice so the spliced real audio matches the dummy.


# Stand-in "sensitive" backends, one per tool. In a real integration each hits the customer's system.
# The field names must match the {placeholders} the LLM authors in post_tool_text (guided by each
# tool's description).
TOOL_MOCKS: dict[str, dict] = {
    "account_balance": {"balance": "$5,899.26", "as_of": "June 3"},
    "crypto_holdings": {"holdings": "0.5 BTC and 3.2 ETH"},
    "recent_payout": {"amount": "$1,250.00", "date": "May 28"},
    "linked_bank": {"bank": "Chase", "last4": "4821"},
}


def fill_post_tool_text(template: str, values: dict) -> str:
    return re.sub(r"\{(\w+)\}", lambda m: str(values.get(m.group(1), m.group(0))), template)


_MONTHS = {
    "January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December", "Jan", "Feb", "Mar", "Apr",
    "Jun", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec",
}


def _scramble(value: str) -> str:
    # Keep "Month D" dates valid (pick a plausible day) instead of scrambling into "May 95".
    m = re.fullmatch(r"([A-Za-z]+)\s+\d{1,2}", value)
    if m and m.group(1) in _MONTHS:
        return f"{m.group(1)} {random.randint(1, 28)}"
    return re.sub(r"\d", lambda _: str(random.randint(0, 9)), value)


def mint_dummy(real: dict) -> dict:
    """A same-shape dummy: keep each field's format, randomize the digits (dates stay valid)."""
    return {k: (_scramble(v) if isinstance(v, str) else v) for k, v in real.items()}


@app.post("/inbound")
async def inbound() -> Response:
    voice_response = VoiceResponse()
    connect = Connect()
    connect.stream(url=f"wss://{os.environ['NGROK_URL'].replace('https://', '')}/ws")
    voice_response.append(connect)
    return Response(content=str(voice_response), media_type="application/xml")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue()
    stream_sid = None
    conversation_id: str | None = None
    conversation_created = asyncio.Event()

    async def handle_tool_call(message: ToolCallPayload):
        args = dict(message.parameters)
        post_tool_text = args.pop("post_tool_text", None)
        real = TOOL_MOCKS.get(message.tool_name, {})

        if post_tool_text is None:
            # Not a redacted tool: behave normally.
            await queue.put(ToolCallOutputPayload(tool_call_id=message.tool_call_id, output=real))
            return

        dummy = mint_dummy(real)
        dummy_sentence = fill_post_tool_text(post_tool_text, dummy)
        real_sentence = fill_post_tool_text(post_tool_text, real)

        # 2a: dummy up to echo (spoken + logged), tagged redacted. `redacted` rides as an extra field.
        await queue.put(
            ToolCallOutputPayload(tool_call_id=message.tool_call_id, output=dummy_sentence, redacted=True)
        )
        # 2b: real sentence to the switcher (never reaches phonic-api/echo).
        await queue.put(
            {
                "type": "real_sentence",
                "conversation_id": conversation_id or "",
                "seq_id": message.tool_call_id,
                "text": real_sentence,
                "output_format": OUTPUT_FORMAT,
                "voice_id": AGENT_VOICE,
            }
        )

    async def receive_from_phonic(message: ConversationsSocketClientResponse):
        nonlocal conversation_id
        if stream_sid is not None and message.type == "audio_chunk":
            try:
                await websocket.send_json(
                    {"event": "media", "streamSid": stream_sid, "media": {"payload": message.audio}}
                )
            except Exception:
                pass  # Twilio stream already closed (e.g. right after a hangup)
        elif message.type == "conversation_created":
            conversation_id = message.conversation_id
            conversation_created.set()
        elif message.type == "user_started_speaking":
            # Barge-in. The switcher front-loads a spliced real turn into Twilio's buffer, so stopping
            # upstream audio does not stop playback; tell Twilio to drop its buffered audio so the
            # caller can cut in on the real turn too. This is the barge-in signal the SDK surfaces; it
            # also fires on backchannels, but the agent recovers from those.
            if stream_sid is not None:
                try:
                    await websocket.send_json({"event": "clear", "streamSid": stream_sid})
                except Exception:
                    pass
        elif message.type == "tool_call":
            asyncio.create_task(handle_tool_call(message))
        elif message.type == "assistant_ended_conversation":
            # The agent ended the call (natural_conversation_ending): stop streaming and close the
            # Twilio media stream so the call hangs up instead of sitting in dead air.
            await queue.put(None)
            try:
                await websocket.close()
            except Exception:
                pass

    async def send_to_phonic():
        async with client.conversations.connect() as socket:
            socket.on("message", receive_from_phonic)
            asyncio.create_task(socket.start_listening())
            await socket.send_config(
                ConfigPayload(
                    agent="coinbase-deep-redaction-demo",
                    input_format=OUTPUT_FORMAT,
                    output_format=OUTPUT_FORMAT,
                )
            )

            while True:
                chunk = await queue.get()
                if chunk is None:
                    break
                if isinstance(chunk, AudioChunkPayload):
                    await socket.send_audio_chunk(chunk)
                elif isinstance(chunk, ToolCallOutputPayload):
                    await socket.send_tool_call_output(chunk)
                elif isinstance(chunk, dict) and chunk.get("type") == "real_sentence":
                    await socket._send(chunk)  # raw frame the switcher intercepts

    async def handle_websocket():
        process_task = asyncio.create_task(send_to_phonic())
        try:
            while True:
                data = await websocket.receive_json()
                if data["event"] == "start":
                    nonlocal stream_sid
                    stream_sid = data["streamSid"]
                if data["event"] == "media" and conversation_created.is_set():
                    await queue.put(AudioChunkPayload(audio=data["media"]["payload"]))
                if data["event"] == "closed":
                    break
        finally:
            await queue.put(None)
            await process_task

    await handle_websocket()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=3000, help="Port to listen on")
    args = parser.parse_args()
    print(f"Listening on port {args.port}")
    uvicorn.run(app, host="0.0.0.0", port=args.port)
