import { config } from "dotenv";
import { PhonicClient } from "phonic";

config({ path: ".env.local" });

const client = new PhonicClient({
  apiKey: process.env.PHONIC_API_KEY,
});

async function outboundCall() {
  await client.conversations.outboundCall({
    to_phone_number: process.env.CUSTOMER_PHONE_NUMBER as string,
    config: {
      agent: "my-first-agent",
    },
  });
}

outboundCall();
