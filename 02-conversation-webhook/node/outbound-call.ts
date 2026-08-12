import { config } from "dotenv";
import { PhonicClient } from "phonic";

config({ path: ".env.local" });

const client = new PhonicClient({
  apiKey: process.env.PHONIC_API_KEY,
  baseUrl: process.env.PHONIC_API_URL,
});

async function outboundCall() {
  const conversation = await client.conversations.outboundCall({
    to_phone_number: process.env.CUSTOMER_PHONE_NUMBER as string,
    config: {
      agent: "travel-agent",
      template_variables: {
        customer_name: "Alice",
        interest: "nature",
      },
    },
  });

  console.log("Outbound conversation:", conversation);
}

outboundCall();
