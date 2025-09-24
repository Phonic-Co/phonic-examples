import os

from dotenv import load_dotenv
from phonic import Phonic

load_dotenv(".env.local")

client = Phonic(
    api_key=os.getenv("PHONIC_API_KEY"),
)


def create_agent():
    client.agents.create(
        name="my-first-agent",
        phone_number="assign-automatically",
    )


if __name__ == "__main__":
    create_agent()
