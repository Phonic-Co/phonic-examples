import argparse
import asyncio
import os

import httpx
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response, WebSocket
from phonic import AsyncPhonic, AudioChunkPayload
from phonic.conversations.socket_client import ConversationsSocketClientResponse
from phonic.types.config_payload import ConfigPayload

load_dotenv(".env.local")

app = FastAPI()
client = AsyncPhonic(api_key=os.getenv("PHONIC_API_KEY"))
TELNYX_API_KEY = os.getenv("TELNYX_API_KEY")


def ws_url() -> str:
    return f"wss://{os.environ['NGROK_URL'].removeprefix('https://')}/ws"


@app.get("/inbound")
@app.post("/inbound")
async def inbound() -> Response:
    # bidirectionalMode="rtp" lets us send the agent's audio back to the caller;
    # bidirectionalCodec must match the agent (PCMU == mulaw_8000). Don't add a
    # track="..." attribute — on a bidirectional <Connect><Stream> it stops
    # Telnyx forwarding the caller's inbound audio.
    texml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response><Connect>"
        f'<Stream url="{ws_url()}" bidirectionalMode="rtp" bidirectionalCodec="PCMU" />'
        "</Connect></Response>"
    )
    return Response(content=texml, media_type="application/xml")


@app.post("/call-control")
async def call_control(request: Request) -> Response:
    # Outbound: start the stream on answer. This must use streaming_start after
    # answer — stream params on the dial request don't establish return audio.
    body = await request.json()
    data = body.get("data", {})
    call_control_id = data.get("payload", {}).get("call_control_id")

    if data.get("event_type") == "call.answered" and call_control_id:
        async with httpx.AsyncClient() as http:
            resp = await http.post(
                f"https://api.telnyx.com/v2/calls/{call_control_id}/actions/streaming_start",
                headers={"Authorization": f"Bearer {TELNYX_API_KEY}"},
                json={
                    "stream_url": ws_url(),
                    "stream_bidirectional_mode": "rtp",
                    "stream_bidirectional_codec": "PCMU",
                },
            )
        if resp.status_code >= 400:
            print(f"streaming_start failed: {resp.status_code} {resp.text}")

    return Response(status_code=200)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue()
    stream_id = None
    conversation_created = asyncio.Event()

    async def receive_from_phonic(message: ConversationsSocketClientResponse):
        match message.type:
            case "audio_chunk":
                # Only send once Telnyx's "start" has set stream_id. Don't gate
                # conversation_created on it — that message can arrive first.
                if stream_id is not None:
                    # Telnyx frame: event + media.payload only, no stream id.
                    await websocket.send_json(
                        {"event": "media", "media": {"payload": message.audio}}
                    )
            case "conversation_created":
                conversation_created.set()
            case "error":
                print(f"Phonic error: {message.error}")

    async def send_to_phonic():
        async with client.conversations.connect() as socket:
            socket.on("message", receive_from_phonic)
            asyncio.create_task(socket.start_listening())

            await socket.send_config(
                ConfigPayload(
                    agent="agent-telnyx",
                    input_format="mulaw_8000",
                    output_format="mulaw_8000",
                )
            )

            while True:
                chunk = await queue.get()
                if chunk is None:
                    break
                await socket.send_audio_chunk(chunk)

    async def handle_websocket():
        nonlocal stream_id
        process_task = asyncio.create_task(send_to_phonic())

        try:
            while True:
                data = await websocket.receive_json()
                event = data.get("event")

                if event == "start":
                    stream_id = data["stream_id"]
                elif event == "media":
                    # A bidirectional stream forks only the caller's audio, so
                    # forward every frame (don't filter on media.track).
                    if conversation_created.is_set():
                        await queue.put(
                            AudioChunkPayload(audio=data["media"]["payload"])
                        )
                elif event == "stop":
                    break
        finally:
            # Signal send_to_phonic to stop, then wait for it, swallowing
            # cancellation and surfacing any unexpected error during teardown.
            await queue.put(None)
            try:
                await process_task
            except asyncio.CancelledError:
                # Expected when the connection closes mid-flight; nothing to do.
                pass
            except Exception as error:
                print(f"send_to_phonic task failed: {error}")

    await handle_websocket()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("PORT", "3000")),
        help="Port to listen on",
    )
    args = parser.parse_args()

    print(f"Listening on port {args.port}")
    uvicorn.run(app, host="0.0.0.0", port=args.port)
