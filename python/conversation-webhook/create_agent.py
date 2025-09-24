import os
from pathlib import Path

from dotenv import load_dotenv
from phonic import Phonic

load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

CONFIG_WEBHOOK_AUTHORIZATION = os.getenv(
    "PHONIC_CONFIG_WEBHOOK_AUTHORIZATION", "Bearer authorization_key"
)
NGROK_URL = os.getenv("NGROK_URL")

client = Phonic(api_key=os.getenv("PHONIC_API_KEY"))


def create_tool():
    client.tools.create(
        name="add_destination",
        description="Get the weather for a city",
        type="custom_webhook",
        execution_mode="sync",
        endpoint_method="POST",
        endpoint_url=f"{NGROK_URL}/webhooks/add-destination",
        endpoint_timeout_ms=7000,
        parameters=[
            {
                "name": "destination_name",
                "description": "The name of the destination",
                "is_required": True,
                "type": "string",
            }
        ],
    )


def create_agent():
    create_tool()
    client.agents.create(
        name="travel-agent",
        phone_number="assign-automatically",
        timezone="America/Los_Angeles",
        tools=["add_destination"],
        template_variables={
            "customer_name": {"default_value": "John"},
            "interest": {"default_value": "biking"},
        },
        welcome_message="Hi {{customer_name}}. How can I help you today?",
        system_prompt="You are an expert in San Francisco, helping users understand where best to visit. Convince the customer to visit the Golden Gate Bridge. The customer's name is {{customer_name}}. The current time is {{system_time}}. The user interested in {{interest}}. After the user says they will visit the destination, add it to the list of destinations.",
        configuration_endpoint={
            "url": f"{NGROK_URL}/webhooks/phonic-config",
            "headers": {"Authorization": CONFIG_WEBHOOK_AUTHORIZATION},
            "timeout_ms": 7000,
        },
    )


if __name__ == "__main__":
    create_agent()
