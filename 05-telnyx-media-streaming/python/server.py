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
    # bidirectionalMode="rtp" is what lets us send the agent's audio back to the
    # caller; bidirectionalCodec must match the agent (PCMU 8 kHz == mulaw_8000).
    # Do NOT add track="..." to a bidirectional <Connect><Stream> — it makes
    # Telnyx stop forwarding the caller's inbound audio entirely.
    texml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response><Connect>"
        f'<Stream url="{ws_url()}" bidirectionalMode="rtp" bidirectionalCodec="PCMU" />'
        "</Connect></Response>"
    )
    return Response(content=texml, media_type="application/xml")


@app.post("/call-control")
async def call_control(request: Request) -> Response:
    # Outbound: Telnyx posts call lifecycle events here. On answer we start a
    # bidirectional stream with streaming_start — passing stream params to the
    # dial request does NOT establish the return-audio path.
    body = await request.json()
    data = body.get("data", {})
    if data.get("event_type") == "call.answered":
        call_control_id = data.get("payload", {}).get("call_control_id")
        if call_control_id:
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

    # Frame counters so you can confirm audio flows BOTH ways.
    frames_from_telnyx = 0
    frames_to_telnyx = 0

    async def log_stats():
        while True:
            await asyncio.sleep(2)
            print(
                f"[audio] Telnyx->Phonic: {frames_from_telnyx} frames | "
                f"Phonic->Telnyx: {frames_to_telnyx} frames"
            )

    async def receive_from_phonic(message: ConversationsSocketClientResponse):
        nonlocal frames_to_telnyx
        match message.type:
            case "audio_chunk":
                # Only send once Telnyx's "start" has set stream_id. Do NOT gate
                # conversation_created below on stream_id — it often arrives
                # before "start", and dropping it stalls inbound forwarding.
                if stream_id is not None:
                    # Telnyx frame: event + media.payload only, no stream id.
                    await websocket.send_json(
                        {"event": "media", "media": {"payload": message.audio}}
                    )
                    frames_to_telnyx += 1
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
        nonlocal stream_id, frames_from_telnyx
        process_task = asyncio.create_task(send_to_phonic())
        stats_task = asyncio.create_task(log_stats())

        try:
            while True:
                data = await websocket.receive_json()
                event = data.get("event")

                if event == "start":
                    stream_id = data["stream_id"]
                    print(f"Telnyx stream started: {stream_id}")
                elif event == "media":
                    # A bidirectional stream forks only the caller's audio, so
                    # forward every frame (don't filter on media.track).
                    if conversation_created.is_set():
                        await queue.put(
                            AudioChunkPayload(audio=data["media"]["payload"])
                        )
                        frames_from_telnyx += 1
                elif event == "stop":
                    break
        finally:
            stats_task.cancel()
            await queue.put(None)
            await process_task
            print(
                "Telnyx WebSocket closed. Final counts -> "
                f"Telnyx->Phonic: {frames_from_telnyx}, "
                f"Phonic->Telnyx: {frames_to_telnyx}"
            )

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
