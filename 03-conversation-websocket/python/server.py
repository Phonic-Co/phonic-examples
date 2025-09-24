import argparse
import asyncio
import os

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Response, WebSocket
from phonic import AsyncPhonic, AudioChunkPayload
from phonic.conversations.socket_client import \
    ConversationsSocketClientResponse
from phonic.types.config_payload import ConfigPayload
from twilio.twiml.voice_response import Connect, VoiceResponse

load_dotenv(".env.local")

app = FastAPI()
client = AsyncPhonic(api_key=os.getenv("PHONIC_API_KEY"))


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

    async def send_to_phonic():
        async with client.conversations.connect() as socket:
            # Register the on-message handler
            socket.on("message", receive_from_phonic)
            asyncio.create_task(socket.start_listening())

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

    async def handle_websocket():
        # Start the task that sends audio to Phonic
        process_task = asyncio.create_task(send_to_phonic())

        try:
            while True:
                data = await websocket.receive_json()

                # The first message from Twilio contains the streamSid, which is necessary
                # for all subsequent messages to Twilio.
                if data["event"] == "start":
                    nonlocal stream_sid
                    stream_sid = data["streamSid"]

                if data["event"] == "media":
                    payload = data["media"]["payload"]
                    await queue.put(AudioChunkPayload(audio=payload))
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

    port = args.port
    print(f"Listening on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
