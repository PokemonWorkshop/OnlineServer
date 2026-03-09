# PSDK Online Server

A lightweight, dependency-minimal backend designed to provide online features for games built with the Pokemon SDK (PSDK) framework. It exposes a REST API and a WebSocket server over native Node.js HTTP, without Express or any routing framework, backed by MongoDB through Mongoose.

---

## Table of Contents

- [Purpose](#purpose)
- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Running the Server](#running-the-server)
- [API Overview](#api-overview)
- [WebSocket Protocol](#websocket-protocol)
- [Documentation](#documentation)
- [Telemetry Dashboard](#telemetry-dashboard)
- [Testing](#testing)
- [Environment Variables Reference](#environment-variables-reference)

---

## Purpose

This server acts as the online backend for a PSDK game project. It handles everything that requires a persistent, shared state between players: account registration, real-time battles, creature trading, the Global Trade System (GTS), a Mystery Gift distribution system, and a friend list with online presence detection.

The codebase deliberately avoids heavy frameworks. The HTTP router, middleware chain, and WebSocket dispatcher are all written from scratch on top of Node.js built-ins. This keeps the binary small, the startup time fast, and the deployment straightforward.

---

## Architecture

```
src/
├── config/          Environment validation and database connection
├── http/
│   ├── router.ts    Minimal regex-based HTTP router
│   ├── middleware.ts API key enforcement, player extraction, admin guard
│   └── routes/      One file per feature domain
├── ws/
│   ├── WsServer.ts  WebSocket connection lifecycle and message dispatch
│   ├── BaseRoom.ts  Shared room abstraction (battle and trade sessions)
│   ├── types.ts     Augmented WebSocket type (playerId, trainerName, roomId)
│   └── handlers/    battleHandler.ts, tradeHandler.ts
├── services/        Business logic, isolated from transport layer
├── models/          Mongoose schemas
├── telemetry/       In-memory metrics, HTTP dashboard, DB persistence
└── index.ts         Bootstrap: DB, router, HTTP server, WebSocket server
```

The project is split into three clearly separated concerns:

**Transport layer** (`http/`, `ws/`): Handles incoming connections, validates headers and query parameters, deserializes payloads, and delegates to services. No business logic lives here.

**Service layer** (`services/`): Contains all business rules. Services are plain classes with no framework coupling. They interact with Mongoose models and return structured result objects (`{ ok: boolean, error?: string }`).

**Data layer** (`models/`): Mongoose schemas with indexes defined where needed. All TTL-based expiry (GTS deposits and pending results) is handled at the MongoDB level.

---

## Features

**Authentication**
Every HTTP request requires an `x-api-key` header matching the configured `API_KEY`. WebSocket connections pass the same key as an `apiKey` query parameter. A separate `ADMIN_KEY` gates telemetry and Mystery Gift admin endpoints.

**Player Registration**
A single endpoint registers or updates a player. On first call, a friend code is generated and a Player document is created. On subsequent calls, the trainer name is updated if it changed and `lastSeen` is refreshed.

**Friend List**
Players are identified by an 8-digit friend code. The list endpoint returns each friend enriched with an `isOnline` flag based on `lastSeen` recency (60-second threshold). A heartbeat endpoint allows clients to maintain online presence.

**Global Trade System (GTS)**
Players deposit a creature along with a wanted species. Other players can search deposits by species, level, and gender, then execute a trade that atomically swaps ownership. Deposits expire automatically after a configurable number of days via a MongoDB TTL index. A species blacklist prevents specific creatures from entering the GTS.

When a trade executes while the original depositor is offline, the received creature is stored as a **pending result** (`GtsPendingResult`). The depositor can list their pending results at any time and claim each one individually, guaranteeing they never lose a traded creature.

**Mystery Gift**
Gifts can be of type `internet` (visible to all players, optionally capped by claim count) or `code` (redeemed with a secret code). Players can claim each gift once. Gifts can carry items, creatures, or eggs. The admin API supports creating, deactivating, and purging expired gifts.

**Real-Time Battles (WebSocket)**
The server manages challenge/accept/decline handshakes between connected players. Once accepted, both players are placed in a `BattleRoom` and exchange actions through the server. Turn order is enforced server-side and disconnections are handled gracefully.

**Real-Time Trades (WebSocket)**
Both players offer a creature, then confirm. The trade executes server-side once both confirmations arrive, sending each player the other's creature in a single atomic message.

**Telemetry**
An in-process metrics store tracks request counts, error rates, WebSocket connection counts, database operation latency, and more. Metrics are persisted to MongoDB on a configurable interval and restored at startup. A live HTML dashboard is available at `/telemetry`.

---

## Project Structure

```
.
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   └── env.ts
│   ├── http/
│   │   ├── middleware.ts
│   │   ├── router.ts
│   │   ├── doc.ts
│   │   └── routes/
│   │       ├── auth.routes.ts
│   │       ├── friends.routes.ts
│   │       ├── gts.routes.ts
│   │       ├── mysteryGift.routes.ts
│   │       └── telemetry.routes.ts
│   ├── models/
│   │   ├── GtsDeposit.ts
│   │   ├── GtsPendingResult.ts
│   │   ├── MysteryGift.ts
│   │   ├── Player.ts
│   │   └── TelemetrySnapshot.ts
│   ├── services/
│   │   ├── FriendService.ts
│   │   ├── GtsService.ts
│   │   └── MysteryGiftService.ts
│   ├── telemetry/
│   │   ├── store.ts
│   │   ├── httpTelemetry.ts
│   │   ├── dbTelemetry.ts
│   │   ├── persist.ts
│   │   ├── dashboard.html
│   │   └── api-docs.html
│   ├── ws/
│   │   ├── BaseRoom.ts
│   │   ├── WsServer.ts
│   │   ├── types.ts
│   │   └── handlers/
│   │       ├── battleHandler.ts
│   │       └── tradeHandler.ts
│   ├── index.ts
│   ├── logger.ts
│   └── swagger.ts
├── tests/
│   ├── setup.ts
│   ├── http/
│   │   ├── middleware.test.ts
│   │   ├── router.test.ts
│   │   └── routes/
│   ├── services/
│   └── ws/
├── .env.example
├── docker-compose.yml
├── docker-compose.server-only.yml
├── Dockerfile
├── Dockerfile.mongodb
├── init_mongo.sh
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

---

## Prerequisites

- Node.js 20 or later
- MongoDB 6 or later (or Docker)
- npm 9 or later

---

## Configuration

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

At minimum, generate strong random keys for `API_KEY` and `ADMIN_KEY`:

```bash
openssl rand -hex 32   # run twice, use once for each key
```

See [Environment Variables Reference](#environment-variables-reference) for all available options.

---

## Running the Server

### Local Development

```bash
npm install
npm run dev
```

The server connects to MongoDB using the `DB_*` variables in `.env`. With default settings it expects MongoDB on `localhost:27017` with no authentication.

### Docker (Full Stack)

Starts both the application server and a MongoDB instance in the same Docker network. MongoDB is initialized with a dedicated application user on first startup via `init_mongo.sh`.

Add the following to your `.env` before starting:

```env
MONGO_INITDB_ROOT_USERNAME=adminuser
MONGO_INITDB_ROOT_PASSWORD=adminpassword
DB_USER=appuser
DB_PSWD=apppassword
```

```bash
docker compose up --build
```

The server waits for MongoDB to pass its health check before starting. Data is persisted in a named Docker volume (`mongo_data`). Logs are persisted in `server_logs`.

### Docker (External MongoDB)

Use this when you already have a MongoDB instance running elsewhere (Atlas, a dedicated VM, etc.). Set `DB_HOST` in `.env` to your MongoDB host and configure `DB_USER`/`DB_PSWD` if authentication is required.

```bash
docker compose -f docker-compose.server-only.yml up --build
```

---

## API Overview

### Authentication

All HTTP endpoints (except the `/telemetry` dashboard HTML page) require:

```
x-api-key: <API_KEY>
```

Admin endpoints additionally require:

```
x-admin-key: <ADMIN_KEY>
```

Player-scoped endpoints require:

```
x-player-id: <unique player identifier>
```

WebSocket connections authenticate via query parameters on connect:

```
ws://host:port?apiKey=<API_KEY>&playerId=<id>&trainerName=<n>
```

WebSocket close codes: `4001` invalid API key, `4002` missing player ID, `4003` session replaced by a newer connection from the same player.

### Endpoints

**Auth**

| Method | Path                    | Auth    | Description                                       |
| ------ | ----------------------- | ------- | ------------------------------------------------- |
| POST   | `/api/v1/auth/register` | API key | Register or update a player. Returns friend code. |

**Friends** — all require `x-player-id`

| Method | Path                                  | Description                        |
| ------ | ------------------------------------- | ---------------------------------- |
| GET    | `/api/v1/friends`                     | Get friend list with online status |
| POST   | `/api/v1/friends/heartbeat`           | Refresh lastSeen timestamp         |
| POST   | `/api/v1/friends/request/:friendCode` | Send a friend request              |
| POST   | `/api/v1/friends/accept/:friendCode`  | Accept a pending request           |
| POST   | `/api/v1/friends/decline/:friendCode` | Decline a pending request          |
| DELETE | `/api/v1/friends/:friendCode`         | Remove a friend                    |

**GTS** — all require `x-player-id`

| Method | Path                                          | Description                                                          |
| ------ | --------------------------------------------- | -------------------------------------------------------------------- |
| GET    | `/api/v1/gts/deposit`                         | Get own active deposit                                               |
| POST   | `/api/v1/gts/deposit`                         | Deposit a creature                                                   |
| GET    | `/api/v1/gts/search`                          | Search deposits (`?speciesId=&level=&gender=&page=`)                 |
| POST   | `/api/v1/gts/trade/:depositId`                | Execute a trade                                                      |
| DELETE | `/api/v1/gts/deposit`                         | Withdraw own deposit                                                 |
| GET    | `/api/v1/gts/pending`                         | List creatures received while offline                                |
| POST   | `/api/v1/gts/pending/claim/:pendingResultId`  | Claim a pending result (retrieve the received creature)              |

**Mystery Gift** — player routes require `x-player-id`, admin routes require `x-admin-key`

| Method | Path                                 | Description                 |
| ------ | ------------------------------------ | --------------------------- |
| GET    | `/api/v1/mystery-gift`               | List claimable gifts        |
| POST   | `/api/v1/mystery-gift/claim`         | Claim by `giftId` or `code` |
| POST   | `/api/v1/mystery-gift/admin/create`  | Create a gift               |
| DELETE | `/api/v1/mystery-gift/admin/:giftId` | Deactivate a gift           |
| POST   | `/api/v1/mystery-gift/admin/purge`   | Purge expired gifts         |

The full OpenAPI specification is served at `/api-docs` when the server is running.

---

## WebSocket Protocol

All messages are JSON objects with a `type` field and an optional `payload` object.

**Client to server:**

```json
{ "type": "BATTLE_CHALLENGE", "payload": { "targetPlayerId": "abc123" } }
```

**Server to client:**

```json
{
  "type": "BATTLE_STATE",
  "payload": { "roomId": "battle_xyz", "turn": "abc123" }
}
```

**Battle flow:** `BATTLE_CHALLENGE` -> `BATTLE_ACCEPT` / `BATTLE_DECLINE` -> `BATTLE_ACTION` (repeated) -> `BATTLE_END`

**Trade flow:** `TRADE_REQUEST` -> `TRADE_ACCEPT` / `TRADE_DECLINE` -> `TRADE_OFFER` -> `TRADE_CONFIRM` (both players) -> `TRADE_COMPLETE`

**Utility:** `PING` (server responds `PONG`). The server sends `ERROR` on invalid JSON, unknown type, or protocol violations.

---

## Documentation

The documentation is available at this address:

```
http://localhost:3000/api-docs
```

No key required for the HTML page itself.

---

## Telemetry Dashboard

The live metrics dashboard is available at:

```
http://localhost:3000/telemetry
```

No key required for the HTML page itself. The underlying JSON API (`/telemetry/summary`, `/telemetry/errors`, etc.) requires the `x-admin-key` header.

---

## Testing

The test suite uses [Vitest](https://vitest.dev/) and requires no running MongoDB instance. Mongoose models are fully mocked with `vi.mock()`. WebSocket integration tests spin up a real in-process HTTP+WebSocket server on an OS-assigned port.

```bash
# Run all tests once
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## Environment Variables Reference

| Variable                     | Required    | Default       | Description                                                        |
| ---------------------------- | ----------- | ------------- | ------------------------------------------------------------------ |
| `PORT`                       | No          | `3000`        | HTTP server port                                                   |
| `NODE_ENV`                   | No          | `development` | Runtime environment (`development`, `production`, `test`)          |
| `DB_HOST`                    | No          | `localhost`   | MongoDB host. Set to `mongodb` when using Docker Compose.          |
| `DB_PORT`                    | No          | `27017`       | MongoDB port                                                       |
| `DB_NAME`                    | No          | `psdk_online` | Database name                                                      |
| `DB_USER`                    | No          | _(empty)_     | MongoDB username. Leave empty for unauthenticated local instances. |
| `DB_PSWD`                    | No          | _(empty)_     | MongoDB password                                                   |
| `API_KEY`                    | Yes         | _(none)_      | Shared key required on every client request                        |
| `ADMIN_KEY`                  | Yes         | _(none)_      | Separate key for admin and telemetry endpoints                     |
| `GTS_SPECIES_BLACKLIST`      | No          | _(empty)_     | Comma-separated species IDs blocked from the GTS (e.g. `150,151`) |
| `GTS_EXPIRY_DAYS`            | No          | `30`          | Days before a GTS deposit (or pending result) expires              |
| `MONGO_INITDB_ROOT_USERNAME` | Docker only | _(none)_      | MongoDB root admin username, created on first container start      |
| `MONGO_INITDB_ROOT_PASSWORD` | Docker only | _(none)_      | MongoDB root admin password                                        |
