import { config } from "dotenv";
import { PhonicClient } from "phonic";

config({ path: ".env.local" });

const client = new PhonicClient({
  apiKey: process.env.PHONIC_API_KEY,
  baseUrl: process.env.PHONIC_API_BASE_URL,
});

async function outboundCall() {
  await client.conversations.outboundCall({
    to_phone_number: "YOUR_PHONE_NUMBER", // e.g. +19189391262
    config: {
      agent: "my-first-agent",
      welcome_message: "Hello, how can I help you?",
    },
  });
}

await outboundCall();
