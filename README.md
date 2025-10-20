# OpenWeatherMap MCP Server

A TypeScript MCP (Model Context Protocol) server that provides weather forecast data from OpenWeatherMap API using Streamable HTTP transport.

## Overview

This MCP server enables AI assistants and other MCP clients to fetch weather forecasts for any city worldwide. Built with the latest **@modelcontextprotocol/sdk v1.20.1**, it provides a simple and reliable interface to OpenWeatherMap's 5-day forecast API.

## Features

- 🌤️ **Weather Forecasts**: Get 1-5 day weather forecasts for any city
- 🌍 **Global Coverage**: Search by city name with optional country code
- 📊 **Detailed Data**: Temperature (min/max/avg), weather descriptions, and more
- 🔄 **MCP Protocol**: Built on @modelcontextprotocol/sdk v1.20.1
- 🚀 **HTTP Transport**: Uses Streamable HTTP for easy deployment
- 🛡️ **Type Safe**: Full TypeScript implementation with Zod validation

## Prerequisites

- Node.js 22+ (see `.nvmrc` for exact version)
- OpenWeatherMap API key (free tier available at [openweathermap.org](https://openweathermap.org/api))

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd mcp-server-template-nodejs
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp .env.example .env
```

1. Add your OpenWeatherMap API key to `.env`:

```env
OPENWEATHERMAP_API_KEY=your_api_key_here
MCP_HTTP_PORT=3000
```

## Usage

### Development

Start the development server with hot-reload:

```bash
npm run dev
```

The server will start on `http://localhost:3000` and automatically restart when you make changes to the source code.

### Production Build

Build the project for production:

```bash
npm run build
```

The compiled JavaScript will be output to the `dist/` directory.

### Start Production Server

```bash
npm start
```

### Testing with MCP Inspector

Use the MCP inspector tool to test your server:

```bash
npm run inspector
```

## Available Tools

### getWeatherForecast

Fetches weather forecast data for a specified city.

**Parameters:**

- `city` (string, required): The name of the city to get the weather for
- `country` (string, optional): The two-letter country code (e.g., 'US', 'GB')
- `days` (number, optional): Number of days for the forecast (1-5 days, default is 3)

**Example:**

```json
{
  "city": "Paris",
  "country": "FR",
  "days": 5
}
```

**Response:**
Returns a formatted weather forecast with daily averages, min/max temperatures, and weather descriptions.

## Available Prompts

### weatherForecastPrompt

A prompt template that asks for a weather forecast in a friendly, conversational way.

## API Endpoints

- `POST /mcp` - Main MCP communication endpoint
- `GET /mcp` - Returns "Method not allowed" (405)
- `DELETE /mcp` - Returns "Method not allowed" (405)

## Project Structure

```bash
src/
├── index.ts        # Express server with HTTP transport
├── server.ts       # McpServer with tools and prompts
├── config.ts       # Environment configuration with Zod validation
└── types.ts        # TypeScript types for OpenWeatherMap API
```

### File Roles

#### `src/index.ts`

**Role:** HTTP Server Entry Point

- Sets up Express.js application
- Configures Streamable HTTP transport for MCP protocol
- Handles POST requests to `/mcp` endpoint (main communication)
- Returns 405 (Method Not Allowed) for GET and DELETE requests
- Manages server lifecycle (startup, shutdown via SIGINT)
- Creates new `McpServer` instance per request via `getServer()`

#### `src/server.ts`

**Role:** MCP Server Logic & Tool Definitions

- Exports `getServer()` function that returns configured `McpServer` instance
- Defines the `getWeatherForecast` tool with Zod schema validation
- Implements OpenWeatherMap API integration logic
- Handles API responses and formats weather data
- Defines the `weatherForecastPrompt` template
- Contains all business logic for weather data processing

#### `src/config.ts`

**Role:** Environment Configuration & Validation

- Validates required environment variables using Zod schemas
- Ensures `OPENWEATHERMAP_API_KEY` is present and non-empty
- Provides `MCP_HTTP_PORT` with default value of 3000
- Exits process with clear error messages if configuration is invalid
- Exports typed `config` object for use across the application

#### `src/types.ts`

**Role:** TypeScript Type Definitions

- Defines `ForecastItem` interface for individual weather data points
- Defines `ForecastResponse` interface for full API response structure
- Ensures type safety when working with OpenWeatherMap API responses
- Documents the shape of API data (temperature, weather, wind, etc.)
- Used by `server.ts` for type checking and autocomplete

## Development

### Adding New Tools

To add a new tool, modify `src/server.ts`:

```typescript
server.tool(
  "tool-name",
  "Tool description",
  {
    // Define your parameters using Zod schemas
    param: z.string().describe("Parameter description"),
  },
  async (args): Promise<CallToolResult> => {
    const { param } = args;
    // Your tool implementation
    return {
      content: [
        {
          type: "text",
          text: `Result: ${param}`,
        },
      ],
    };
  },
);
```

### Adding New Prompts

To add a new prompt template, modify `src/server.ts`:

```typescript
server.prompt(
  "prompt-name",
  "Prompt description",
  async (): Promise<GetPromptResult> => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Your prompt content here`,
          },
        },
      ],
    };
  },
);
```

## Technologies Used

- **@modelcontextprotocol/sdk** v1.20.1 - Latest MCP SDK for building protocol servers
- **Express.js** v5.1.0 - Web framework for HTTP transport
- **Zod** v3.23.8 - Schema validation
- **TypeScript** - Type-safe development
- **OpenWeatherMap API** - Weather data source

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `OPENWEATHERMAP_API_KEY` | Your OpenWeatherMap API key | Yes | - |
| `MCP_HTTP_PORT` | Port for the HTTP server | No | 3000 |

## Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [OpenWeatherMap API Documentation](https://openweathermap.org/api)
- [Express.js Documentation](https://expressjs.com/)

## License

This project is based on the Alpic MCP Server Template.
