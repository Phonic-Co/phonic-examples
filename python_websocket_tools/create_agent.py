from phonic import CreateAgentRequestTemplateVariablesValue, Phonic

client = Phonic()

system_prompt = """
Be helpful, friendly, and concise.
Today is {{today_date}}.
You have 1 tool, called find_flights_sync.
If you are about to call a tool, you can say something like "Just wait a moment while I look up flights".
The result of the tool call may not sound natural if you read it directly,
so please convert the tool call response to something more natural when saying it.
For example, don't read out entire bulleted lists.
"""

client.agents.create(
    name="find-flights-sync-agent",
    welcome_message="Hi {{customer_name}}. What flights are you interested in?",
    system_prompt=system_prompt,
    audio_format="mulaw_8000",
    template_variables={
        "customer_name": CreateAgentRequestTemplateVariablesValue(
            default_value="there"
        ),
        "today_date": CreateAgentRequestTemplateVariablesValue(default_value=None),
    },
    tools=["find_flights_sync"],
)
