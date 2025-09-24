import os
from pathlib import Path

from dotenv import load_dotenv
from phonic import Phonic

load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

client = Phonic(api_key=os.getenv("PHONIC_API_KEY"))


def outbound_call():
    client.conversations.outbound_call(
        to_phone_number=os.getenv("CUSTOMER_PHONE_NUMBER", ""),
        config={
            "agent": "travel-agent",
            "template_variables": {
                "customer_name": "Alice",
                "interest": "nature",
            },
        },
    )


if __name__ == "__main__":
    outbound_call()
