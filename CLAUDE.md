# OpenWeatherMap MCP Server - Project Overview

## Project Summary

This is a Model Context Protocol (MCP) server that provides weather forecast data from OpenWeatherMap API. Built with TypeScript and Express.js, it enables AI assistants and other MCP clients to fetch weather forecasts for any city worldwide.

## Technology Stack

- **MCP SDK**: @modelcontextprotocol/sdk v1.20.1
- **Runtime**: Node.js 22+
- **Framework**: Express.js v5.1.0
- **Language**: TypeScript
- **Validation**: Zod v3.23.8
- **Transport**: Streamable HTTP
- **API**: OpenWeatherMap 5-day Forecast API

## Architecture Overview

```bash
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client (AI Assistant)                 │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP POST /mcp
                         │ (MCP Protocol Messages)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    src/index.ts                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Express Server + Streamable HTTP Transport        │    │
│  │  - Handles MCP requests                            │    │
│  │  - Creates transport per request                   │    │
│  │  - Returns 405 for non-POST methods                │    │
│  └────────────────┬───────────────────────────────────┘    │
└───────────────────┼────────────────────────────────────────┘
                    │ getServer()
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    src/server.ts                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  McpServer Instance                                │    │
│  │  - Tool: getWeatherForecast                        │    │
│  │  - Prompt: weatherForecastPrompt                   │    │
│  │  - Zod schema validation                           │    │
│  └────────────────┬───────────────────────────────────┘    │
└───────────────────┼────────────────────────────────────────┘
                    │ fetch()
                    ▼
┌─────────────────────────────────────────────────────────────┐
│            OpenWeatherMap API (External)                     │
│  https://api.openweathermap.org/data/2.5/forecast          │
│  - Returns 5-day forecast data                              │
│  - 3-hour intervals                                          │
└─────────────────────────────────────────────────────────────┘
```
## File Structure & Responsibilities

### Core Application Files

#### `src/index.ts` - HTTP Server Entry Point
**Purpose**: Sets up Express server and MCP HTTP transport

**Responsibilities**:
- Initialize Express.js application
- Configure Streamable HTTP transport for MCP
- Handle POST requests to `/mcp` endpoint
- Create new McpServer instance per request
- Manage server lifecycle (startup/shutdown)
- Return 405 for GET/DELETE methods

**Key Functions**:
- `app.post("/mcp", ...)` - Main MCP communication handler
- `app.listen()` - Start HTTP server on configured port
- `process.on("SIGINT")` - Graceful shutdown handler

---

#### `src/server.ts` - MCP Server Logic
**Purpose**: Defines MCP tools and business logic

**Responsibilities**:
- Export `getServer()` factory function
- Define `getWeatherForecast` tool with Zod validation
- Implement OpenWeatherMap API integration
- Format weather data for display
- Define `weatherForecastPrompt` template
- Handle API errors and edge cases

**Key Functions**:
- `getServer()` - Returns configured McpServer instance
- `server.tool("getWeatherForecast", ...)` - Weather forecast tool
- `server.prompt("weatherForecastPrompt", ...)` - Prompt template

**Tool Details**:
```typescript
getWeatherForecast({
  city: string,           // Required: City name
  country?: string,       // Optional: ISO country code (US, GB, FR, etc.)
  days?: number          // Optional: 1-5 days (default: 3)
})
```

---

#### `src/config.ts` - Environment Configuration
**Purpose**: Validate and export environment configuration

**Responsibilities**:
- Define Zod schemas for environment variables
- Validate `OPENWEATHERMAP_API_KEY` presence
- Provide default `MCP_HTTP_PORT` (3000)
- Exit with clear error if config invalid
- Export typed `config` object

**Exports**:
```typescript
export const config = {
  OPENWEATHERMAP_API_KEY: string,
  MCP_HTTP_PORT: number
}
```

---

#### `src/types.ts` - TypeScript Definitions
**Purpose**: Type safety for OpenWeatherMap API

**Responsibilities**:
- Define `ForecastItem` interface (single data point)
- Define `ForecastResponse` interface (full API response)
- Document API data structure
- Enable IDE autocomplete
- Prevent runtime type errors

**Types**:
```typescript
interface ForecastItem {
  dt: number;
  dt_txt: string;
  main: { temp, temp_min, temp_max, pressure, humidity };
  weather: Array<{ id, main, description, icon }>;
  clouds: { all };
  wind: { speed, deg };
}

interface ForecastResponse {
  cod: string;
  cnt: number;
  list: ForecastItem[];
  city: { id, name, country, timezone };
}
```

---

### Configuration Files

#### `package.json`
- Package name: `mcp-server-openweather`
- Version: 1.0.0
- Main entry: `dist/index.js`
- Scripts: build, dev, start, inspector
- Dependencies: MCP SDK, Express, Zod, dotenv

#### `tsconfig.json`
- Target: ES2022
- Module: NodeNext
- Output: dist/
- Strict mode enabled
- Excludes: test files, langchain examples

#### `.env` (gitignored)
```env
OPENWEATHERMAP_API_KEY=your_api_key_here
MCP_HTTP_PORT=3000
```

#### `.env.example` (committed)
Template for users to copy and configure

---

## Data Flow

### Request Flow (getWeatherForecast)

1. **Client Request** → MCP client sends tool call request
2. **HTTP Handler** → Express receives POST to `/mcp`
3. **Transport** → StreamableHTTPServerTransport processes MCP message
4. **Server** → `getServer()` creates McpServer instance
5. **Tool Execution** → `getWeatherForecast` tool invoked
6. **Validation** → Zod validates parameters (city, country, days)
7. **API Call** → Fetch OpenWeatherMap API with query params
8. **Data Processing**:
   - Group forecast data by date
   - Calculate min/max/avg temperatures
   - Extract weather descriptions
   - Format as human-readable text
9. **Response** → Return formatted forecast to client

### Error Handling

- **Invalid API Key** → Returns "🔑 Invalid API key" message
- **City Not Found** → Returns "❌ Could not find weather data" message
- **Network Error** → Returns "An unexpected error occurred" message
- **Missing Config** → Process exits with Zod validation error

---

## API Integration Details

### OpenWeatherMap API

**Endpoint**: `https://api.openweathermap.org/data/2.5/forecast`

**Query Parameters**:
- `q`: City name with optional country code (e.g., "Paris,FR")
- `appid`: API key from environment
- `units`: "metric" (Celsius)
- `cnt`: Number of 3-hour intervals (days × 8, max 40)

**Response Processing**:
- Data comes in 3-hour intervals
- Server groups by date (YYYY-MM-DD)
- Calculates daily aggregates:
  - Average temperature
  - Min/max temperatures
  - Most common weather description
- Returns formatted text with emojis

---

## Development Workflow

### Local Development
```bash
npm run dev          # Start with hot-reload
npm run inspector    # Test with MCP Inspector
```

### Building
```bash
npm run build        # Compile TypeScript to dist/
```

### Production
```bash
npm start            # Run compiled JavaScript
```

### Testing Tools
```bash
# MCP Inspector
npm run inspector    # Opens inspector UI

# Manual HTTP test
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

---

## Deployment Considerations

### Environment Setup
1. Obtain OpenWeatherMap API key (free tier available)
2. Set `OPENWEATHERMAP_API_KEY` environment variable
3. Optionally set `MCP_HTTP_PORT` (defaults to 3000)

### Security
- API key stored in environment, never committed
- No authentication on MCP endpoint (add if needed)
- CORS not configured (add if needed for browser clients)

### Scalability
- Stateless server design
- New McpServer instance per request
- Can run multiple instances behind load balancer
- No database or persistent state

### Monitoring
- Console logging on startup/shutdown
- Request errors logged to console.error
- No structured logging (consider adding for production)

---

## Extension Points

### Adding New Tools

1. Define tool in `src/server.ts`:
```typescript
server.tool(
  "toolName",
  "Tool description",
  { /* Zod schema */ },
  async (args) => { /* implementation */ }
);
```

2. Add types if needed in `src/types.ts`
3. Update README with tool documentation

### Adding New APIs

1. Add API key/config to `src/config.ts`
2. Define types in `src/types.ts`
3. Implement tool in `src/server.ts`
4. Update environment variables documentation

### Adding Authentication

1. Modify `src/index.ts` to add middleware:
```typescript
app.use(authenticateMiddleware);
```

2. Validate tokens/keys before processing MCP requests

---

## Common Issues & Solutions

### "Invalid API key" error
- Check `.env` file exists
- Verify `OPENWEATHERMAP_API_KEY` is set correctly
- Remove any quotes around the API key
- Restart server after changing `.env`

### "City not found" error
- Check city name spelling
- Try adding country code (e.g., "Paris,FR")
- Use English city names

### Port already in use
- Change `MCP_HTTP_PORT` in `.env`
- Kill process using port 3000: `lsof -ti:3000 | xargs kill`

### Build errors
- Ensure Node.js 22+ is installed
- Delete `node_modules` and reinstall: `npm install`
- Check TypeScript version matches `package.json`

---

## API Limits & Quotas

### OpenWeatherMap Free Tier
- 1,000 API calls per day
- 60 calls per minute
- 5-day forecast with 3-hour intervals

### Rate Limiting
- No rate limiting implemented in this server
- Consider adding rate limiting for production use
- Can use `express-rate-limit` package

---

## Future Enhancements

Potential improvements:
- [ ] Add caching layer (Redis) to reduce API calls
- [ ] Implement rate limiting on MCP endpoint
- [ ] Add authentication/authorization
- [ ] Support additional weather data (current, hourly, etc.)
- [ ] Add unit/integration tests
- [ ] Structured logging (Winston, Pino)
- [ ] Health check endpoint
- [ ] Metrics/monitoring (Prometheus)
- [ ] Docker containerization
- [ ] CI/CD pipeline configuration

---

## References

- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [OpenWeatherMap API Docs](https://openweathermap.org/api)
- [Express.js Documentation](https://expressjs.com/)
- [Zod Documentation](https://zod.dev/)

---

## Maintenance Notes

### Dependencies
- Regularly update MCP SDK for new features/fixes
- Monitor OpenWeatherMap API changes
- Keep Express.js and Zod up to date

### Breaking Changes
- MCP SDK v2.x may introduce breaking changes
- OpenWeatherMap API v3.x requires migration
- Zod v4.x has different type inference

### Security Updates
- Run `npm audit` regularly
- Update dependencies with security patches
- Review OpenWeatherMap API security best practices
