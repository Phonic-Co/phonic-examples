import { PhonicClient } from "phonic";
import { phonicApiKey } from "./env-vars";

const client = new PhonicClient({
  apiKey: phonicApiKey,
});

async function createAgent() {
  await client.agents.create({
    name: "agent-websocket-tools",
    welcome_message: "Hi there. How can I help you today?",
    system_prompt: "Be helpful, friendly, and concise.",
    audio_format: "mulaw_8000",
    tools: [
      {
        name: "current_time",
        description: "Get the current time",
        input_schema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "current_temperature",
        description: "Get the current temperature",
        input_schema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The location to get the temperature for",
            },
          },
          required: ["location"],
        },
      },
    ],
  });
}

createAgent();
