import os

from dotenv import load_dotenv
from phonic import Phonic

load_dotenv(".env.local")

client = Phonic(
    api_key=os.getenv("PHONIC_API_KEY"),
)

client.conversations.outbound_call(
    to_phone_number=os.getenv("CUSTOMER_PHONE_NUMBER", "") # e.g. +15551234567
    config={
        "agent": "my-first-agent",
        "welcome_message": "Hello, how can I help you?",
    },
)
