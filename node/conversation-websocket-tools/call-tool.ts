async function getTemperature({ city }: { city: string }) {
  console.log(`Getting temperature for ${city}`);

  try {
    // First, get coordinates for the city
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const geoResponse = await fetch(geocodingUrl);

    if (!geoResponse.ok) {
      throw new Error(`Geocoding API error: ${geoResponse.status}`);
    }

    const geoData = (await geoResponse.json()) as {
      results?: Array<{
        latitude: number;
        longitude: number;
        name: string;
      }>;
    };

    if (!geoData.results || geoData.results.length === 0) {
      return {
        city,
        error: `Could not find location: ${city}`,
      };
    }

    const { latitude, longitude, name } = geoData.results[0];

    // Fetch temperature from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&temperature_unit=fahrenheit`;
    const weatherResponse = await fetch(weatherUrl);

    if (!weatherResponse.ok) {
      throw new Error(`Weather API error: ${weatherResponse.status}`);
    }

    const weatherData = (await weatherResponse.json()) as {
      current: {
        temperature_2m: number;
      };
    };

    const temp = Math.round(weatherData.current.temperature_2m);

    return {
      city: name,
      temperature: `${temp}°F`,
    };
  } catch (error) {
    console.error("Error fetching temperature:", error);
    return {
      city,
      error: "Failed to fetch temperature",
    };
  }
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
