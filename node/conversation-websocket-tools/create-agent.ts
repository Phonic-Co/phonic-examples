import { PhonicClient } from "phonic";
import { phonicApiKey } from "./env-vars";

const client = new PhonicClient({
  apiKey: phonicApiKey,
});

const prompt = `You are a helpful weather assistant. You can help users get the current temperature
and weather conditions for any city. When a user asks about the weather or temperature,
use the get_temperature tool to fetch the current conditions for their requested city.
Be friendly and conversational. You can provide the temperature in both Fahrenheit and
describe the weather conditions. Some example cities you can check the weather for:
- New York
- Los Angeles
- Chicago
- Miami
- Seattle
- Denver
If the user asks about multiple cities, you can check them one at a time.`;

async function createAgent() {
  await client.agents.create({
    name: "agent-websocket-temperature",
    welcome_message:
      "Hi there. Which cities are you interested in checking the weather for?",
    system_prompt: prompt,
    tools: ["get_temperature"],
  });
}

createAgent();
