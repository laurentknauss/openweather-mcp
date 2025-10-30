import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CallToolResult, GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import type { ForecastItem, ForecastResponse } from "./types.js";
import { config } from './config.js'; 

// Added import for MCP-UI
import { createUIResource } from "@mcp-ui/server";

export function getServer(): McpServer {
  const server = new McpServer({
    name: "weather-server",
    version: "0.0.1",
  });

  server.tool(
    "getWeatherForecast",
    "Give a weather forecast for a city with interactive UI visualization",
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

      try {
        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 404) {
            return {
              content: [{ type: "text", text: `❌ Could not find weather data for ${location}.` }],
            };
          } else if (response.status === 401) {
            return {
              content: [{ type: "text", text: `🔑 Invalid API key.` }],
            };
          } else {
            return {
              content: [{ type: "text", text: `API Error: ${response.statusText}` }],
            };
          }
        }

        const data: ForecastResponse = await response.json();

        if (data.cod !== "200") {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${data.message || "Failed to fetch weather data"}`,
              },
            ],
          };
        }

        // Process data into daily forecasts
        const forecastByDay: Record<string, { temps: number[]; descs: string[]; min: number; max: number }> = {};

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
        const resultText = `🌤️ Weather forecast for ${locationName}:\n${forecastList.join("\n")}`;

        // Extract coordinates for UI (from city data in API response)
        let lat = data.city.coord?.lat || 0;
        let lon = data.city.coord?.lon || 0;

        if (lat === 0 || lon === 0) {
          // Fallback: Geocode if no coords
          const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`;
          const geoResponse = await fetch(geoUrl);
          const geoData = await geoResponse.json();
          if (geoData.length > 0) {
            lat = geoData[0].lat;
            lon = geoData[0].lon;
          }
        }

        // Create UIResource for interactive weather map (external iframe)
        const uiResource = createUIResource({
          uri: "ui://weather/map",
          content: {
            type: "externalUrl",
            iframeUrl: `https://openweathermap.org/weathermap?basemap=map&cities=true&layer=temp&lat=${lat}&lon=${lon}&zoom=10`,
          },
          encoding: "text",
        });

        // Return hybrid content: text + UI
        return {
          content: [{ type: "text", text: resultText }, uiResource],
        };
      } catch (error: any) {
        console.error("Forecast fetch error:", error);
        return {
          content: [
            {
              type: "text",
              text: `An unexpected error occurred: ${error.message}`,
            },
          ],
        };
      }
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
