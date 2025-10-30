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
│  │  - NO server.resource() - See design decision      │    │
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

## Architectural Decision: Tool-Only Design (No Resources)

### Design Choice Rationale

This MCP server intentionally implements **only tools** and **prompts**, with **no `server.resource()` blocks**. This is a deliberate architectural decision based on the nature of weather data.

### Why No Resources?

#### 1. Functional Completeness ✅
The `getWeatherForecast` tool already provides everything a resource would:
- Fetches live weather data on-demand
- Formats output with daily aggregates
- Returns structured results with MCP-UI visualization
- No functional gap exists

#### 2. Avoids Data Staleness ✅
Resources in MCP are typically **static or cached content** that clients can list/read. Weather data changes every 3 hours, making resources problematic:

**Problem with resource approach**:
```typescript
// Hypothetical BAD resource approach
server.resource("weather://paris-forecast", async () => {
  // This would be stale after 3 hours!
  return { content: "Yesterday's forecast..." };
});
```

**Our tool-based approach**: Always fetches **live data** on every call, ensuring freshness.

Resources would require:
- Cache invalidation logic
- TTL (Time-To-Live) management
- Version tracking
- Refresh mechanisms

This adds unnecessary complexity for real-time data.

#### 3. Simpler Client Experience ✅
**With tool-only approach**:
```typescript
// Client calls tool
mcp.callTool("getWeatherForecast", { city: "Paris", days: 3 });
// Gets fresh data immediately
```

**With resources (unnecessary complexity)**:
```typescript
// Client lists resources
const resources = await mcp.listResources();
// Finds "weather://paris-fr"
// Reads resource (might be stale)
const data = await mcp.readResource("weather://paris-fr");
// Still needs to call tool for fresh data!
```

Tools are simpler for dynamic, query-based data.

#### 4. Parameter Flexibility ✅
Our tool accepts **3 parameters** (city, country, days).

**With resources**, we'd need to create:
```typescript
weather://paris-fr-3days
weather://paris-fr-5days
weather://london-gb-3days
weather://tokyo-jp-1day
// Explosion of resource URIs for every city/country/days combo!
```

OpenWeatherMap supports **200,000+ cities**. The combinatorial explosion of URIs (cities × countries × days) makes resources impractical.

**Tools handle parameterized queries elegantly.** Resources don't scale for combinatorial inputs.

#### 5. MCP Protocol Best Practices ✅
MCP resources are designed for:
- ✅ Static documentation (API schemas, guides)
- ✅ File system access (project files)
- ✅ Database records (read-only entities)

**Not ideal for**:
- ❌ Real-time API calls
- ❌ Parameterized queries
- ❌ Frequently changing data

Our use case (real-time weather forecasts) doesn't fit the resource model.

#### 6. No Caching Needed ✅
**Hypothetical scenario**: If AI agents repeatedly ask for the same city within 10 minutes, cached resources could reduce API calls.

**Counter-arguments**:
- OpenWeatherMap free tier: **1,000 calls/day** (generous limit)
- Server is stateless by design (no cache infrastructure)
- Adding caching adds complexity (Redis, TTL logic, invalidation)
- Better handled at HTTP/proxy layer if needed in production

**Verdict**: Premature optimization. Current approach is sufficient.

### Comparison Table

| Criterion | Tool-Only (Current Design) | Adding Resources |
|-----------|---------------------------|------------------|
| **Functional completeness** | ✅ Complete | ⚠️ Redundant |
| **Data freshness** | ✅ Always live | ❌ Stale without TTL |
| **Client simplicity** | ✅ One call | ❌ Multi-step |
| **Parameter handling** | ✅ Flexible | ❌ URI explosion |
| **MCP best practices** | ✅ Aligned | ⚠️ Misaligned |
| **Maintenance burden** | ✅ Low | ❌ High |
| **API quota efficiency** | ✅ On-demand | ❌ Pre-fetch waste |

### When Resources Would Make Sense

You should consider `server.resource()` **only if** you add:

#### 1. Static Weather Documentation
```typescript
server.resource("weather://api-docs", async () => {
  return {
    uri: "weather://api-docs",
    mimeType: "text/markdown",
    text: "# OpenWeatherMap API Documentation\n..."
  };
});

server.resource("weather://supported-countries", async () => {
  return {
    uri: "weather://supported-countries",
    mimeType: "application/json",
    text: JSON.stringify(["US", "GB", "FR", "DE", ...])
  };
});
```

#### 2. Historical Weather Data (if API supports)
```typescript
server.resource("weather://paris-fr/history/2025-10-01", async () => {
  // Historical data doesn't change, suitable for resources
  return { ... };
});
```

#### 3. Preset City Collections
```typescript
server.resource("weather://collections/european-capitals", async () => {
  return {
    uri: "weather://collections/european-capitals",
    mimeType: "application/json",
    text: JSON.stringify([
      { city: "Paris", country: "FR" },
      { city: "Berlin", country: "DE" },
      // ...
    ])
  };
});
```

**But even then**, these could be **tools** that return lists! Tools are more flexible.

### Final Verdict

**Tool-only design is correct for this use case.** It's:
- ✅ Architecturally sound
- ✅ Aligned with MCP best practices for dynamic data
- ✅ Simple to maintain
- ✅ Scales well with parameters
- ✅ Always returns fresh data

**Resources should only be added for truly static content** (docs, schemas, historical data), not real-time weather forecasts.

### References
- [MCP Resources Specification](https://modelcontextprotocol.io/docs/concepts/resources)
- [MCP Tools vs Resources Guide](https://modelcontextprotocol.io/docs/concepts/tools)
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

## Weather Alerts Strategy

### Current API Limitation

**Important**: The 5-day Forecast API (`/data/2.5/forecast`) used by this server **does NOT include weather alerts** (storms, floods, heat warnings, etc.).

Government weather alerts are only available in OpenWeatherMap's **One Call API 3.0** (`/data/3.0/onecall`), which:
- Requires lat/lon coordinates (not city names)
- Needs geocoding step to convert city → coordinates
- Has 1,000 free calls/day (sufficient but requires separate subscription)
- Includes: `sender_name`, `event`, `start`, `end`, `description`, `tags`

### Optimal Solution: Hybrid Approach

**Strategy**: Keep current forecast API + supplement with web search for alerts

**Why This Works Better:**

1. ✅ **No API changes needed** - Current free tier forecast API works as-is
2. ✅ **Real-time news coverage** - Web search finds breaking alerts from news sites, meteorological agencies (Météo-France, NWS, etc.)
3. ✅ **Better coverage** - News sources often report storms BEFORE they appear in API data
4. ✅ **Contextual intelligence** - Only searches when user asks about alerts/warnings
5. ✅ **No additional costs** - Uses existing Brave Search MCP tool availability
6. ✅ **Comprehensive** - Catches alerts that might not be in OpenWeatherMap's system

### AI Agent Workflow

When a user asks for weather forecast and mentions alerts/warnings:

**Example User Prompt:**
```bash
"What's the forecast for Paris in the next 3 days - is there an alert?
I saw something on TV news about a storm?"
```
**Agent Response Pattern:**

1. **First**: Call `getWeatherForecast` tool for regular forecast data
   ```bash
   🌤️ Weather forecast for Paris, FR:
   📅 2025-10-23: 🌡️ Avg 12°C (Min 10°C, Max 13°C), 🌥️ light rain
   📅 2025-10-24: 🌡️ Avg 11°C (Min 8°C, Max 14°C), 🌥️ light rain
   📅 2025-10-25: 🌡️ Avg 12°C (Min 9°C, Max 15°C), 🌥️ scattered clouds
   ```
2. **Second**: Detect alert-related keywords and call `brave_web_search`
   ```text
   Query: "Paris France weather alert storm warning October 2025"
   or
   Query: "[city] [country] weather alert [current month/year]"
   ```
3. **Third**: Synthesize results and present comprehensive response
   ```bash
   Based on the forecast, you'll see light rain today and tomorrow with
   temperatures around 10-14°C, improving by Saturday.

   Regarding alerts - let me verify current warnings...

   🚨 YES - Active alert detected! Storm Benjamin is hitting Paris today
   (Oct 23) with wind gusts up to 85-100 km/h. Météo-France has issued
   a yellow-orange alert for Île-de-France. Parks are closed and transport
   disruptions expected.

   You were right to check after seeing the TV news!
   ```
### Trigger Keywords for Alert Search

AI agent should search for alerts when user mentions:

**Direct Alert References:**
- "alert", "warning", "advisory"
- "storm", "tempest", "cyclone", "hurricane"
- "flood", "flooding", "rain warning"
- "heat wave", "extreme heat"
- "cold snap", "freeze warning"
- "snow storm", "blizzard"

**Information Sources:**
- "TV news", "news said", "heard about"
- "météo france", "weather service"
- "emergency", "danger"

**Concern Indicators:**
- "should I be worried", "is it safe"
- "dangerous", "severe weather"
- "cancelled", "closed" (parks, schools)

**Implicit Triggers:**
- High wind speeds in forecast (>70 km/h)
- Extreme temperatures
- Heavy precipitation indicators

### Real-World Example: Storm Benjamin (Oct 2025)

**Without Alert Search:**
```bash
User: "Weather forecast for Paris 3 days?"
Tool: Returns "light rain" without storm warning
Result: ❌ User unaware of dangerous 100 km/h winds
```
**With Alert Search:**
```bash
User: "Weather forecast for Paris 3 days - any alerts?"
Tool 1: Returns "light rain" (regular forecast)
Tool 2: Brave Search finds "Storm Benjamin" news
Result: ✅ User warned about dangerous conditions
```
### Alternative Approaches Considered

#### Option A: Switch to One Call API 3.0
- ❌ Requires geocoding step (adds complexity)
- ❌ Needs separate subscription
- ❌ Still misses breaking news alerts
- ❌ Only includes alerts AFTER official issuance

#### Option B: Add Wind Speed Analysis
- ⚠️ Can estimate storm potential from wind data
- ❌ Doesn't include official government alerts
- ❌ Misses other alert types (flood, heat, etc.)
- ⚠️ Requires additional calculation logic

#### Option C: Hybrid Approach (CHOSEN)
- ✅ Best of both worlds
- ✅ Leverages existing tools
- ✅ Most comprehensive coverage
- ✅ Zero code changes required
- ✅ Contextually intelligent

### Implementation Status

**Current Implementation:**
- ✅ Forecast tool working (src/server.ts)
- ✅ Brave Search available to AI agent
- ✅ AI agent can detect alert keywords
- ✅ AI agent can search and synthesize results

**No Code Changes Required:**
- Tool description adequately hints at limitation
- AI reasoning naturally triggers searches
- Brave Search already configured in Claude Code

**Optional Enhancement:**
- Could update tool description to explicitly mention:
  ```typescript
  "Give a weather forecast for a city. Note: This API does not include
  government weather alerts. If user asks about alerts/warnings,
  supplement with web search."
  ```

### Best Practices for Alert Handling

1. **Always search when user explicitly asks about alerts**
2. **Proactively search if forecast shows extreme conditions** (high winds, heavy rain)
3. **Use specific search queries**: Include city, country, current date/month
4. **Verify multiple sources**: Cross-reference news sites and official agencies
5. **Present clearly**: Use emojis (🚨 ⚠️) and formatting for visibility
6. **Include timing**: When alert starts/ends
7. **Provide context**: What to do, what's closed, safety advice

### Search Query Templates

**General Alert Search:**
```text
"{city} {country} weather alert warning {month} {year}"
```
**Specific Storm Search:**
```text
"{city} storm warning wind alert {date}"
```
**Agency-Specific Search:**
```text
"Météo-France alert {city} {date}"  (France)
"NWS warning {city} {date}"         (USA)
"Met Office warning {city} {date}"  (UK)
```
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
