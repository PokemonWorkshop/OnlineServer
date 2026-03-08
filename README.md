# PSDK Online Server

A lightweight, dependency-minimal HTTP + WebSocket server for PSDK multiplayer features. Built with native Node.js HTTP, the `ws` library, MongoDB via Mongoose, and zero web framework overhead.

---

## Features

### 🔐 Authentication
All requests are protected by a shared API key (`x-api-key` header for HTTP, `?apiKey=` query param for WebSocket). A separate admin key (`x-admin-key`) gates sensitive endpoints such as Mystery Gift administration and telemetry data.

### 👥 Friends
- Send, accept, decline, and cancel friend requests
- List current friends and pending requests
- Remove a friend

### 🔄 GTS (Global Trade System)
- Deposit a creature with a trade request (species + level range)
- Browse all active deposits
- Execute a trade between two players
- Configurable species blacklist and automatic expiry (TTL via MongoDB)

### 🎁 Mystery Gifts
- **Internet gifts** — publicly listed, claimable by any connected player
- **Code gifts** — redeemed with a secret code
- Supports creatures, eggs, and items (with quantity) in a single gift
- Per-gift validity window (`validFrom` / `validTo`), claim limit, and player whitelist
- Full admin API: create, update, activate/deactivate, delete gifts

### 🏦 PokéBank
- Per-player cloud storage organised in boxes and slots
- Configurable box count (`POKEBANK_MAX_BOXES`) and box size (`POKEBANK_BOX_SIZE`)
- Deposit and withdraw creatures; server treats creature data as opaque (no schema lock-in)

### ⚡ WebSocket — Real-time
- Single `/ws` endpoint shared with HTTP (same port)
- Player authentication on connection (`playerId` + `apiKey` as query params)
- Automatic session replacement when the same player reconnects
- **Battle** — challenge, accept/decline, move exchange, flee, result
- **Trade** — request, accept/decline, item exchange, confirm, cancel
- Keepalive with `PING` / `PONG`

### 📊 Telemetry Dashboard
Built-in, zero-dependency monitoring available at `http://localhost:<PORT>/telemetry`.

- Live counters: HTTP requests, WebSocket connections, DB queries, errors
- Per-route latency histograms (7 buckets: <10ms → ≥1000ms, min/max/avg)
- Per-WS-message-type breakdown
- Rolling 24-hour hourly snapshots (persisted to MongoDB every 5 minutes)
- Ring buffer of the last 200 events (HTTP, WS, DB, errors)

### 📖 Swagger / OpenAPI
Auto-generated API documentation at `http://localhost:<PORT>/api-docs` — no external service required.

### 🩺 Health Check
`GET /health` returns `{ status: "ok", uptime: <seconds> }` with no authentication required. Suitable for load balancer and uptime monitor probes.

---

## Requirements

- **Node.js** ≥ 18 (LTS recommended)
- **MongoDB** ≥ 6
- **Docker** (optional but recommended for deployment)

---

## Configuration

Copy `.env.example` to `.env` and fill in the values:

```env
# Server
PORT=3000
NODE_ENV=production

# MongoDB — full URI used directly by Mongoose
MONGODB_URI=mongodb://user:password@localhost:27017/psdk_online

# Auth — generate with: openssl rand -hex 32
API_KEY=change_me_with_a_strong_random_key
ADMIN_KEY=change_me_with_a_different_strong_key

# GTS
GTS_SPECIES_BLACKLIST=       # comma-separated species IDs, e.g. 150,151
GTS_EXPIRY_DAYS=30

# PokéBank
POKEBANK_MAX_BOXES=8
POKEBANK_BOX_SIZE=30
```

> `API_KEY` and `ADMIN_KEY` must be different values. The admin key should never be shared with game clients.

---

## Running with Docker (recommended)

### Full stack — server + MongoDB

```bash
docker compose up -d
```

The server waits for MongoDB to pass its healthcheck before starting.

### Server only — external MongoDB

If you already have a MongoDB instance, update `MONGODB_URI` in your `.env`, then:

```bash
docker compose -f docker-compose.server-only.yml up -d
```

### Useful commands

```bash
# View live logs
docker logs -f psdk_online_server

# Open a shell inside the container
docker exec -it psdk_online_server sh

# Stop everything
docker compose down

# Stop and remove volumes (⚠️ deletes all data)
docker compose down -v
```

---

## Running locally (no Docker)

```bash
# Install dependencies
npm install

# Development mode (hot reload via tsx)
npm run dev

# Production build
npm run build
npm start
```

Logs are written to `logs/YYYY-MM-DD.log` alongside console output.

---

## API Overview

All routes are prefixed with `/api/v1` and require the `x-api-key` header.
Routes marked 🔒 additionally require `x-admin-key`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register a new player |
| GET | `/api/v1/friends` | List friends |
| POST | `/api/v1/friends/request` | Send a friend request |
| POST | `/api/v1/friends/accept` | Accept a request |
| POST | `/api/v1/friends/decline` | Decline a request |
| DELETE | `/api/v1/friends` | Remove a friend |
| GET | `/api/v1/gts/list` | Browse GTS deposits |
| POST | `/api/v1/gts/deposit` | Deposit a creature |
| POST | `/api/v1/gts/trade` | Execute a trade |
| DELETE | `/api/v1/gts/withdraw` | Withdraw your deposit |
| GET | `/api/v1/mystery-gift/internet` | List claimable internet gifts |
| POST | `/api/v1/mystery-gift/claim/internet/:giftId` | Claim an internet gift |
| POST | `/api/v1/mystery-gift/claim/code` | Claim a gift by code |
| 🔒 POST | `/api/v1/mystery-gift/admin` | Create a gift |
| 🔒 PATCH | `/api/v1/mystery-gift/admin/:giftId` | Update a gift |
| 🔒 DELETE | `/api/v1/mystery-gift/admin/:giftId` | Delete a gift |
| GET | `/api/v1/bank/boxes` | List player bank boxes |
| POST | `/api/v1/bank/deposit` | Deposit a creature |
| POST | `/api/v1/bank/withdraw` | Withdraw a creature |
| GET | `/telemetry` | Dashboard (browser, no auth) |
| 🔒 GET | `/telemetry/summary` | JSON summary |
| 🔒 GET | `/telemetry/routes` | Per-route stats |
| 🔒 GET | `/telemetry/events` | Recent event log |
| GET | `/health` | Health check (no auth) |
| GET | `/api-docs` | Swagger UI |

Full request/response schemas are available at `/api-docs`.

---

## WebSocket Messages

Connect at `ws://localhost:<PORT>/ws?apiKey=<API_KEY>&playerId=<ID>&trainerName=<name>`

All messages use the format `{ "type": "...", "payload": { ... } }`.

| Type | Direction | Description |
|------|-----------|-------------|
| `PING` | → server | Keepalive |
| `PONG` | ← server | Keepalive response |
| `BATTLE_CHALLENGE` | → server | Challenge another player |
| `BATTLE_ACCEPT` | → server | Accept a challenge |
| `BATTLE_DECLINE` | → server | Decline a challenge |
| `BATTLE_MOVE` | → server | Send a move |
| `BATTLE_FLEE` | → server | Flee from battle |
| `BATTLE_RESULT` | → server | Report battle outcome |
| `TRADE_REQUEST` | → server | Request a trade |
| `TRADE_ACCEPT` | → server | Accept a trade |
| `TRADE_DECLINE` | → server | Decline a trade |
| `TRADE_OFFER` | → server | Send a trade offer |
| `TRADE_CONFIRM` | → server | Confirm the trade |
| `TRADE_CANCEL` | → server | Cancel the trade |
| `ERROR` | ← server | Error notification |

---

## License

MIT
