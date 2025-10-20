import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CallToolResult, GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import type { ForecastItem, ForecastResponse } from "./types.js";
import { config } from "./config.js";

export function getServer(): McpServer {
  const server = new McpServer({
    name: "weather-server",
    version: "0.0.1",
  });

  server.tool(
    "getWeatherForecast",
    "Give a weather forecast for a city",
    {
      city: z.string().describe("The name of the city to get the weather for"),
      country: z.string().optional().describe("The two-letter country code (e.g., 'US', 'GB') (optional)"),
      days: z
        .number()
        .min(1)
        .max(5)
        .optional()
        .default(3)
        .describe("Number of days for the forecast (1-5 days, default is 3)"),
    },
    async (args): Promise<CallToolResult> => {
      const { city, country, days = 3 } = args;
      const apiKey = config.OPENWEATHERMAP_API_KEY;
      const location = country ? `${city},${country}` : city;
      const intervals = Math.min(days * 8, 40);
      const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric&cnt=${intervals}`;

      let resultText: string;

      try {
        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 404) {
            resultText = `❌ Could not find weather data for ${location}.`;
          } else if (response.status === 401) {
            resultText = `🔑 Invalid API key.`;
          } else {
            resultText = `API Error: ${response.statusText}`;
          }
        } else {
          // Use the detailed imported type for robust type checking
          const data = (await response.json()) as ForecastResponse;

          const forecastByDay: Record<string, { temps: number[]; descs: string[]; min: number; max: number }> = {};

          // The `item` variable is now correctly typed as ForecastItem
          data.list.forEach((item: ForecastItem) => {
            const date = item.dt_txt.split(" ")[0];
            if (!forecastByDay[date]) {
              forecastByDay[date] = { temps: [], descs: [], min: item.main.temp_min, max: item.main.temp_max };
            }
            forecastByDay[date].temps.push(item.main.temp);
            if (item.weather && item.weather[0]) {
              forecastByDay[date].descs.push(item.weather[0].description);
            }
            forecastByDay[date].min = Math.min(forecastByDay[date].min, item.main.temp_min);
            forecastByDay[date].max = Math.max(forecastByDay[date].max, item.main.temp_max);
          });

          const dates = Object.keys(forecastByDay).sort().slice(0, days);
          const forecastList = dates.map((date) => {
            const day = forecastByDay[date];
            const avg = Math.round(day.temps.reduce((a, b) => a + b, 0) / day.temps.length);
            const desc = day.descs[0] || "clear sky";
            return `📅 ${date}: 🌡️ Avg ${avg}°C (Min ${Math.round(day.min)}°C, Max ${Math.round(day.max)}°C), 🌥️ ${desc}`;
          });

          const locationName = data.city ? `${data.city.name}, ${data.city.country}` : location;
          resultText = `🌤️ Weather forecast for ${locationName}:\n${forecastList.join("\n")}`;
        }
      } catch (error: any) {
        resultText = `An unexpected error occurred: ${error.message}`;
      }

      return {
        content: [{ type: "text", text: resultText }],
      };
    },
  );

  server.prompt(
    "weatherForecastPrompt",
    "A prompt template that asks for a weather forecast for a city in a friendly manner",
    async (): Promise<GetPromptResult> => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please provide a friendly weather forecast.`,
            },
          },
        ],
      };
    },
  );

  return server;
}
