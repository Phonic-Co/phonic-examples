import { PhonicClient } from "phonic";
import { phonicApiKey } from "./env-vars";

const client = new PhonicClient({
  apiKey: phonicApiKey,
});

async function createTool() {
  await client.tools.create({
    name: "get_temperature",
    description:
      "Get the current temperature and weather conditions for a specific city.",
    type: "custom_websocket",
    execution_mode: "sync",
    parameters: [
      {
        type: "string",
        name: "city",
        description: "The name of the city to get the temperature for",
        is_required: true,
      },
    ],
  });
}

createTool();
