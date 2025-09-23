import { config } from "dotenv";
import { PhonicClient } from "phonic";

config({ path: ".env.local" });

const apiKey = process.env.PHONIC_API_KEY;
const configWebhookAuthorization =
  process.env.PHONIC_CONFIG_WEBHOOK_AUTHORIZATION ?? "Bearer authorization_key";
const NGROK_URL = process.env.NGROK_URL;

const client = new PhonicClient({ apiKey });

async function createTool() {
  await client.tools.create({
    name: "add_destination_1",
    description: "Get the weather for a city",
    type: "custom_webhook",
    execution_mode: "sync",
    endpoint_method: "POST",
    endpoint_url: `${NGROK_URL}/webhooks/add-destination`,
    endpoint_timeout_ms: 7000,
    parameters: [
      {
        name: "destination_name",
        description: "The name of the destination",
        is_required: true,
        type: "string",
      },
    ],
  });
}

async function createAgent() {
  await createTool();
  await client.agents.create({
    name: "travel-agent",
    phone_number: "assign-automatically",
    timezone: "America/Los_Angeles",
    tools: ["add_destination"],
    template_variables: {
      customer_name: { default_value: "John" },
      interest: { default_value: "biking" },
    },
    welcome_message: "Hi {{customer_name}}. How can I help you today?",
    system_prompt:
      "You are an expert in San Francisco, helping users understand where best to visit. Convince the customer to visit the Golden Gate Bridge. The customer's name is {{customer_name}}. The current time is {{system_time}}. The user interested in {{interest}}. After the user says they will visit the destination, add it to the list of destinations.",
    configuration_endpoint: {
      url: `${NGROK_URL}/webhooks/phonic-config`,
      headers: { Authorization: configWebhookAuthorization },
      timeout_ms: 7000,
    },
  });
}

createAgent();
