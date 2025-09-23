from phonic import Phonic

client = Phonic()

client.agents.create(
    name="agent-websocket",
    welcome_message="Hi there. How can I help you today?",
    system_prompt="Be helpful, friendly, and concise.",
    audio_format="mulaw_8000",
)
