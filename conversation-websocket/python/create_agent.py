import os
from pathlib import Path

from dotenv import load_dotenv
from phonic import Phonic

load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

client = Phonic(
    api_key=os.getenv("PHONIC_API_KEY"),
)

client.agents.create(
    name="agent-websocket",
    welcome_message="Hi there. How can I help you today?",
    system_prompt="Be helpful, friendly, and concise.",
    audio_format="mulaw_8000",
)
