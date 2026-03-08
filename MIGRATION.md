# Migration Guide — Old Server → New Server

This document explains what changed between the original **OnlineServer** and the new **PSDK Online Server**, why each decision was made, and how to migrate.

---

## Architecture at a glance

| Aspect | Old Server | New Server |
|--------|-----------|-----------|
| HTTP framework | Custom `HttpServer` wrapper | Native `node:http` + lightweight `Router` class |
| WebSocket | `socket.io`-style custom `Server` | `ws` library directly |
| Transport | HTTP and WS on **separate** internal servers joined by `rawHttpServer` | HTTP and WS on the **same** port, WS at `/ws` |
| Auth model | Two tokens: `TOKEN_SERVER` (auto-generated) + `TOKEN_API` | Two explicit keys: `API_KEY` (client) + `ADMIN_KEY` (admin) |
| Environment | Many fragmented variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PSWD`…) | Single `MONGODB_URI` + clean flat config |
| Dependency count | Higher (Express-like abstractions, token tasks…) | Minimal: `mongoose`, `ws`, `dotenv`, `zod` |
| Logging | `Logger` class overriding `console.*`, writes daily `.log` files | Same approach, carried forward and integrated |
| Monitoring | None | Built-in telemetry dashboard + JSON API |
| API documentation | TypeDoc (generate manually) | Live Swagger UI at `/api-docs` |
| New features | — | PokéBank, Telemetry, Swagger, Health check, admin Mystery Gift API |

---

## Detailed differences

### 1. No more auto-generated `TOKEN_SERVER`

The old server generated a random token on first start and wrote it into `.env`. This was clever but caused confusion: the token was invisible until you shelled into the container.

The new server uses two explicit keys that **you** define before starting:

- `API_KEY` — shared with all PSDK game clients. Sent as `x-api-key` on HTTP and `?apiKey=` on WebSocket.
- `ADMIN_KEY` — server-side only. Required for telemetry data endpoints and Mystery Gift admin routes.

Generate strong values with `openssl rand -hex 32`.

---

### 2. Single MongoDB URI instead of split variables

Old:
```env
DB_NAME=psdk_online
DB_HOST=mongodb
DB_PORT=27017
DB_USER=myuser
DB_PSWD=mypassword
```

New:
```env
MONGODB_URI=mongodb://myuser:mypassword@mongodb:27017/psdk_online
```

A single URI is the standard Mongoose pattern. It removes the need for the server to construct the connection string at runtime, and it makes it trivial to switch between local, Atlas, and replica-set URIs without touching server code.

---

### 3. HTTP + WebSocket on the same port

The old server created two separate internal server objects and merged them. The new server passes the native `http.Server` instance directly to `WebSocketServer`, so both protocols share a single port and a single process listener — less moving parts, less memory.

---

### 4. New features not present in the old server

**PokéBank** — Per-player cloud storage. Players can deposit creatures to a remote bank and retrieve them later, across devices or sessions. Box count and size are configurable via `.env`.

**Telemetry dashboard** — A built-in monitoring page accessible in the browser at `/telemetry`. Requires the admin key (prompted via browser JS). Tracks request rates, error rates, latency histograms per route, WS message counts, DB query stats, and a live event log. No external tool (Grafana, Datadog…) needed.

**Swagger UI** — The full REST API is documented with an OpenAPI spec and served at `/api-docs`. Always up to date with the code — no manual documentation step.

**Health check** — `GET /health` returns server status and uptime without requiring any authentication. Ready for Docker healthchecks, Kubernetes liveness probes, or any uptime monitor.

**Mystery Gift admin API** — The old server could serve gifts stored in MongoDB but had no HTTP API to create or manage them. The new server exposes full CRUD under `/api/v1/mystery-gift/admin/*` (requires `ADMIN_KEY`).

---

### 5. Logging carried forward and improved

Both servers override `console.*` to write colourised output and daily log files. The new server uses the same approach with one improvement: `console.debug(label, ...args)` turns the first argument into a custom log-level label (e.g. `console.debug('DB', 'Connected')` → `[DB] ...`), which makes filtering log files easier.

Log files are written to `logs/YYYY-MM-DD.log` in the working directory. In Docker they are stored in the `server_logs` named volume so they survive container restarts.

---

### 6. Cleaner Docker setup

The old `Dockerfile_Server` did `npm install` inside the container including dev dependencies. The new `Dockerfile` uses `npm ci --omit=dev` (faster, reproducible, production-only) and builds TypeScript at image build time (`npm run build`), so the container runs compiled JS rather than transpiling on every start.

---

## Migration checklist

1. **Update your `.env`** — replace the split DB variables with a single `MONGODB_URI`. Replace `TOKEN_SERVER` / `TOKEN_API` with `API_KEY` and `ADMIN_KEY`.

2. **Update your PSDK client** — change the auth header from `Authorization: Bearer <TOKEN>` to `x-api-key: <API_KEY>`. On WebSocket, add `?apiKey=<API_KEY>` to the connection URL.

3. **Re-export your MongoDB data** (if needed) — the Mongoose models are schema-compatible with the old models for players, GTS, and gifts. A `mongodump` / `mongorestore` is sufficient.

4. **Remove `TOKEN_SERVER` from your automation scripts** — there is no longer a generated token to retrieve from inside the container.

5. **Point your monitoring** to `/health` for uptime checks and `/telemetry` for the dashboard (replaces any external log parsing you had set up).
