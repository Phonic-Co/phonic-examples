from phonic import Phonic

client = Phonic()

system_prompt = "Be helpful, friendly, and concise. Today is {{today_date}}."

client.agents.create(
    name="agent-websocket",
    welcome_message="Hi {{customer_name}}. How can I help you today?",
    system_prompt=system_prompt,
    audio_format="mulaw_8000",
    template_variables={
        "customer_name": {"default_value": None},
        "today_date": {"default_value": None},
    },
)
