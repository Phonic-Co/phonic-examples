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
  });
}

createAgent();
