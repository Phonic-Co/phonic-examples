async function getTemperature({ city }: { city: string }) {
  console.log(`Getting temperature for ${city}`);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Return mock temperature data
  const temperatures: Record<string, { temp: string; conditions: string }> = {
    "new york": { temp: "72°", conditions: "partly cloudy" },
    "los angeles": { temp: "78°", conditions: "sunny" },
    chicago: { temp: "65°", conditions: "windy and overcast" },
    miami: { temp: "85°", conditions: "humid and sunny" },
    seattle: { temp: "62°", conditions: "rainy" },
    denver: { temp: "68°", conditions: "clear skies" },
  };

  const cityLower = city.toLowerCase();
  const data = temperatures[cityLower] || { temp: "75°", conditions: "clear" };

  return {
    city,
    temperature: data.temp,
    conditions: data.conditions,
    timestamp: new Date().toISOString(),
  };
}

export async function handleToolCall(message: {
  type: "tool_call";
  tool_call_id: string;
  tool_name: string;
  parameters: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  console.log(
    "Tool call received:",
    JSON.stringify(
      {
        tool_call_id: message.tool_call_id,
        tool_name: message.tool_name,
        parameters: message.parameters,
      },
      null,
      2,
    ),
  );

  switch (message.tool_name) {
    case "get_temperature": {
      const params = message.parameters as {
        city: string;
      };

      try {
        const temperature = await getTemperature(params);
        return temperature;
      } catch (error) {
        console.error("Error fetching temperature:", error);
        return { error: "Failed to fetch temperature" };
      }
    }

    default:
      console.warn(`Unknown tool: ${message.tool_name}`);
      return { error: `Unknown tool: ${message.tool_name}` };
  }
}
