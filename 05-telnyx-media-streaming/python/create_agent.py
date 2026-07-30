import os

from dotenv import load_dotenv
from phonic import Phonic

load_dotenv(".env.local")

client = Phonic(
    api_key=os.getenv("PHONIC_API_KEY"),
)

client.agents.create(
    name="agent-telnyx",
    welcome_message="Hi there. How can I help you today?",
    system_prompt="Be helpful, friendly, and concise.",
    # mulaw_8000 == PCMU 8 kHz, which is what Telnyx streams by default.
    audio_format="mulaw_8000",
)
