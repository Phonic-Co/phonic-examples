import { config } from "dotenv";
import { PhonicClient } from "phonic";

config({ path: ".env.local" });

const client = new PhonicClient({
  apiKey: process.env.PHONIC_API_KEY,
  baseUrl: process.env.PHONIC_API_BASE_URL,
});

async function createAgent() {
  await client.agents.create({
    name: "my-first-agent",
    phone_number: "assign-automatically",
  });
}

createAgent();
