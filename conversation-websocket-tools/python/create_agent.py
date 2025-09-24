import os

from dotenv import load_dotenv
from phonic import Phonic

load_dotenv(".env.local")

client = Phonic(
    api_key=os.getenv("PHONIC_API_KEY"),
)

system_prompt = """
Be helpful, friendly, and concise.
You have 1 tool, called find_flights_sync.
If you are about to call a tool, you can say something like "Just wait a moment while I look up flights".
The result of the tool call may not sound natural if you read it directly,
so please convert the tool call response to something more natural when saying it.
For example, don't read out entire bulleted lists.
"""

client.agents.create(
    name="agent-websocket-find-flights",
    welcome_message="Hi there. What flights are you interested in?",
    system_prompt=system_prompt,
    audio_format="mulaw_8000",
    tools=["find_flights_sync"],
)
