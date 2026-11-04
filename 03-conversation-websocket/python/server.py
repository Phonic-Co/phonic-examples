import argparse
import asyncio
import os
from contextlib import suppress

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Response, WebSocket, WebSocketDisconnect
from phonic import AsyncPhonic, AudioChunkPayload
from phonic.conversations.socket_client import ConversationsSocketClientResponse
from phonic.types.config_payload import ConfigPayload
from twilio.twiml.voice_response import Connect, VoiceResponse

load_dotenv(".env.local")

app = FastAPI()
client = AsyncPhonic(
    api_key=os.getenv("PHONIC_API_KEY"),
    # Resume the same conversation if the connection to Phonic drops mid-call.
    reconnect_conversation_on_abnormal_disconnect=True,
)


@app.post("/inbound")
async def inbound() -> Response:
    voice_response = VoiceResponse()
    connect = Connect()
    connect.stream(url=f"wss://{os.environ['NGROK_URL'].removeprefix('https://')}/ws")
    voice_response.append(connect)
    return Response(content=str(voice_response), media_type="application/xml")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue()
    stream_sid = None
    conversation_created = asyncio.Event()
    stream_started = asyncio.Event()

    async def receive_from_phonic(message: ConversationsSocketClientResponse):
        # Handler that sends Phonic response to Twilio
        if stream_sid is not None:
            match message.type:
                case "audio_chunk":
                    sending = {
                        "event": "media",
                        "streamSid": stream_sid,
                        "media": {"payload": message.audio},
                    }
                    await websocket.send_json(sending)
                case "conversation_created":
                    conversation_created.set()

    async def send_to_phonic():
        async with client.conversations.connect() as socket:
            # Register the on-message handler
            socket.on("message", receive_from_phonic)
            listener_task = asyncio.create_task(socket.start_listening())

            try:
                # Connect early, but wait until Twilio can receive the greeting.
                await stream_started.wait()
                # Send the initial config to Phonic
                await socket.send_config(
                    ConfigPayload(
                        agent="agent-websocket",
                    )
                )

                while True:
                    # Continually get audio from Twilio and send to Phonic
                    chunk = await queue.get()
                    if chunk is None:
                        break
                    if not isinstance(chunk, AudioChunkPayload):
                        raise ValueError(f"Unexpected chunk type: {type(chunk)}.")
                    await socket.send_audio_chunk(chunk)
            finally:
                listener_task.cancel()
                with suppress(asyncio.CancelledError, WebSocketDisconnect):
                    await listener_task

    async def handle_websocket():
        process_task = asyncio.create_task(send_to_phonic())

        try:
            while True:
                data = await websocket.receive_json()

                # Release configuration after saving the stream ID.
                if data["event"] == "start":
                    nonlocal stream_sid
                    if stream_started.is_set():
                        continue
                    stream_sid = data["streamSid"]
                    stream_started.set()

                if data["event"] == "media":
                    if conversation_created.is_set():
                        payload = data["media"]["payload"]
                        await queue.put(AudioChunkPayload(audio=payload))
                if data["event"] in ("stop", "closed"):
                    break

        except WebSocketDisconnect:
            # A carrier hangup is expected; finally closes the Phonic connection.
            pass
        finally:
            try:
                if conversation_created.is_set():
                    # Preserve queued caller audio, but bound shutdown if Phonic stalls.
                    await queue.put(None)
                    with suppress(asyncio.TimeoutError):
                        await asyncio.wait_for(asyncio.shield(process_task), timeout=1)
            finally:
                process_task.cancel()
                with suppress(asyncio.CancelledError):
                    await process_task

    await handle_websocket()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=3000, help="Port to listen on")
    args = parser.parse_args()

    port = args.port
    print(f"Listening on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
