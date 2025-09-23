import os
from pathlib import Path

from dotenv import load_dotenv
from phonic import Phonic

load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

client = Phonic(
    api_key=os.getenv("PHONIC_API_KEY"),
)

client.agents.create(
    name="my-first-agent",
    phone_number="assign-automatically",
)
