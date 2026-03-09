/**
 * OpenAPI 3.0 specification for the PSDK Online Server.
 *
 * Served as JSON at  GET /api-docs/openapi.json
 * Served as Swagger UI at  GET /api-docs
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'PSDK Online Server',
    version: '1.0.0',
    description: `
## Overview
HTTP & WebSocket server for **PSDK Online** — handles player authentication,
friend management, GTS (Global Trade System), Mystery Gifts, and server telemetry.

## Authentication
Every HTTP request **must** include the \`x-api-key\` header (except \`GET /health\` and \`GET /telemetry\`).  
Routes that are player-scoped additionally require the \`x-player-id\` header.

WebSocket connections pass the API key as a query parameter: \`?apiKey=<key>\` (browsers cannot
send custom headers during the WS handshake).

## Creature data
The server stores creature objects as **opaque blobs** (\`Record<string, unknown>\`).  
It does not validate or transform PSDK creature fields — that responsibility lies with the PSDK client.

## Server limits (configurable via environment variables)
| Variable | Default | Description |
|---|---|---|
| \`GTS_EXPIRY_DAYS\` | 30 | Days before a GTS deposit auto-expires (MongoDB TTL) |
| \`GTS_SPECIES_BLACKLIST\` | _(empty)_ | Comma-separated species IDs banned from GTS |

## WebSocket
Connect to \`ws://<host>/ws?apiKey=<key>&playerId=<id>&trainerName=<n>\`.  
All messages use the envelope \`{ "type": "<TYPE>", "payload": { … } }\`.  
See the **WebSocket** tag below for all message types and payloads.
    `.trim(),
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development server' },
  ],

  components: {
    securitySchemes: {
      ApiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description:
          'Shared server API key. Required on every route except `GET /health` and `GET /telemetry`.',
      },
      AdminKey: {
        type: 'apiKey',
        in: 'header',
        name: 'x-admin-key',
        description:
          'Admin-only key for telemetry data endpoints and mystery-gift admin routes. Never shared with clients.',
      },
      PlayerId: {
        type: 'apiKey',
        in: 'header',
        name: 'x-player-id',
        description:
          'Game-side player identifier set by the PSDK client. Required on all player-scoped routes.',
      },
    },

    schemas: {
      // ── Generic ──────────────────────────────────────────────────────────
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string', example: 'Descriptive error message' },
        },
      },
      ValidationError: {
        type: 'object',
        required: ['error', 'details'],
        properties: {
          error: { type: 'string', example: 'Invalid data' },
          details: {
            type: 'object',
            description: 'Zod flatten() output.',
            properties: {
              fieldErrors: {
                type: 'object',
                additionalProperties: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              formErrors: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
      OkResult: {
        type: 'object',
        required: ['ok'],
        properties: {
          ok: { type: 'boolean' },
          error: { type: 'string', description: 'Present only on failure.' },
          message: {
            type: 'string',
            description: 'Present only on success for some routes.',
          },
        },
      },

      // ── Player / Auth ─────────────────────────────────────────────────────
      RegisterBody: {
        type: 'object',
        required: ['playerId', 'trainerName'],
        properties: {
          playerId: {
            type: 'string',
            minLength: 1,
            maxLength: 64,
            description:
              'Immutable game-side identifier assigned by the PSDK client (e.g. a UUID). Acts as the primary key.',
            example: 'a3f2c1d0-1234-5678-abcd-ef0123456789',
          },
          trainerName: {
            type: 'string',
            minLength: 1,
            maxLength: 16,
            description: 'Cosmetic display name. May change on every login.',
            example: 'Ash',
          },
        },
      },
      RegisterResponse: {
        type: 'object',
        properties: {
          friendCode: {
            type: 'string',
            description:
              '8-digit numeric code used for friend requests. Unique per player and immutable.',
            example: '12345678',
          },
          trainerName: { type: 'string', example: 'Ash' },
          alreadyRegistered: {
            type: 'boolean',
            description:
              '`true` if the player already existed in the database.',
          },
          nameUpdated: {
            type: 'boolean',
            description:
              '`true` if the trainer name was changed on this login.',
          },
        },
      },

      // ── Friends ───────────────────────────────────────────────────────────
      FriendEntry: {
        type: 'object',
        properties: {
          playerId: { type: 'string', description: "Friend's game-side ID." },
          trainerName: {
            type: 'string',
            description: "Friend's current display name.",
          },
          friendCode: {
            type: 'string',
            description: "Friend's 8-digit friend code.",
            example: '87654321',
          },
          isOnline: {
            type: 'boolean',
            description:
              '`true` if the friend sent a heartbeat within the last **60 seconds**.',
          },
          lastSeen: {
            type: 'string',
            format: 'date-time',
            description: 'UTC timestamp of their last heartbeat or login.',
          },
        },
      },
      PendingEntry: {
        type: 'object',
        properties: {
          trainerName: { type: 'string' },
          friendCode: { type: 'string', example: '87654321' },
        },
      },
      FriendListResponse: {
        type: 'object',
        properties: {
          friends: {
            type: 'array',
            items: { $ref: '#/components/schemas/FriendEntry' },
            description:
              'Accepted friends, each annotated with a live `isOnline` boolean.',
          },
          pendingRequests: {
            type: 'array',
            items: { $ref: '#/components/schemas/PendingEntry' },
            description:
              "Incoming friend requests awaiting the player's acceptance.",
          },
        },
      },

      // ── GTS ──────────────────────────────────────────────────────────────
      WantedParams: {
        type: 'object',
        required: ['speciesId'],
        properties: {
          speciesId: {
            type: 'string',
            description:
              'Species ID requested in return. Must not be in `GTS_SPECIES_BLACKLIST`.',
            example: 'bulbasaur',
          },
          minLevel: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 1,
            description: 'Minimum acceptable level.',
          },
          maxLevel: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 100,
            description: 'Maximum acceptable level.',
          },
          gender: {
            type: 'string',
            enum: ['male', 'female', 'any'],
            default: 'any',
            description: '`"any"` disables the gender filter.',
          },
        },
      },
      GtsDepositBody: {
        type: 'object',
        required: ['creature', 'wanted'],
        properties: {
          creature: {
            type: 'object',
            additionalProperties: true,
            description:
              'Serialised PSDK creature to deposit. The server reads `creature.speciesId` (string) to check the blacklist.',
          },
          wanted: { $ref: '#/components/schemas/WantedParams' },
        },
      },
      GtsDepositEntry: {
        type: 'object',
        description:
          'A GTS deposit as returned by search results. The `creature` field is **omitted** — it is only revealed after a successful trade.',
        properties: {
          _id: {
            type: 'string',
            description:
              'MongoDB ObjectId — use this as `depositId` when calling `POST /api/v1/gts/trade/:depositId`.',
            example: '64f1a2b3c4d5e6f7a8b9c0d1',
          },
          depositorId: {
            type: 'string',
            description: "Depositing player's ID.",
          },
          depositorName: {
            type: 'string',
            description:
              "Depositing trainer's name (denormalised for display).",
          },
          wantedSpeciesId: { type: 'string', example: 'bulbasaur' },
          wantedMinLevel: { type: 'integer', example: 1 },
          wantedMaxLevel: { type: 'integer', example: 100 },
          wantedGender: { type: 'string', enum: ['male', 'female', 'any'] },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            description: 'Auto-deleted by MongoDB TTL after this date.',
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      GtsMyDeposit: {
        allOf: [
          { $ref: '#/components/schemas/GtsDepositEntry' },
          {
            type: 'object',
            properties: {
              creature: {
                type: 'object',
                additionalProperties: true,
                description:
                  "The actual deposited creature. Visible **only** on the player's own deposit (`GET /api/v1/gts/deposit`).",
              },
            },
          },
        ],
      },
      GtsDepositResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          depositId: {
            type: 'string',
            description:
              'MongoDB `_id` of the created deposit. Use for `POST /api/v1/gts/trade/:depositId`.',
            example: '64f1a2b3c4d5e6f7a8b9c0d1',
          },
          error: { type: 'string' },
        },
      },
      GtsTradeBody: {
        type: 'object',
        required: ['offeredCreature'],
        properties: {
          offeredCreature: {
            type: 'object',
            additionalProperties: true,
            description:
              'PSDK creature being offered. The server reads these fields for validation:\n' +
              '- `offeredCreature.speciesId` (string) — must match `wantedSpeciesId`\n' +
              '- `offeredCreature.level` (number) — must be within `[wantedMinLevel, wantedMaxLevel]`\n' +
              '- `offeredCreature.gender` (string) — must match `wantedGender` unless it is `"any"`',
          },
        },
      },
      GtsTradeResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          receivedCreature: {
            type: 'object',
            additionalProperties: true,
            description:
              'The creature you received from the deposit. Present only on success.',
          },
          error: { type: 'string' },
        },
      },
      GtsWithdrawResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          creature: {
            type: 'object',
            additionalProperties: true,
            description: 'Your withdrawn creature. Present only on success.',
          },
          error: { type: 'string' },
        },
      },
      GtsPendingResult: {
        type: 'object',
        description:
          'A trade result waiting to be claimed by the original depositor. ' +
          'Created when a trader executes a GTS trade while the depositor is offline.',
        properties: {
          _id: {
            type: 'string',
            description: 'MongoDB ObjectId — use as `pendingResultId` when calling `POST /api/v1/gts/pending/claim/:pendingResultId`.',
            example: '64f1a2b3c4d5e6f7a8b9c0d2',
          },
          recipientId: { type: 'string', description: 'Player ID of the original depositor.' },
          receivedCreature: {
            type: 'object',
            additionalProperties: true,
            description: 'The creature sent by the trader.',
          },
          traderName: { type: 'string', description: 'Display name of the trader.', example: 'Gary' },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            description: 'Auto-deleted by MongoDB TTL after this date (GTS_EXPIRY_DAYS from trade time).',
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      GtsPendingClaimResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          creature: {
            type: 'object',
            additionalProperties: true,
            description: 'The claimed creature. Present only on success.',
          },
          error: { type: 'string', description: 'Present only on failure.' },
        },
      },

      // ── Mystery Gift ──────────────────────────────────────────────────────
      GiftItem: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Item ID (PSDK format).',
            example: 'potion',
          },
          count: { type: 'integer', minimum: 1, default: 1, example: 3 },
        },
      },
      GiftCreature: {
        type: 'object',
        required: ['id', 'level'],
        description: 'A fully-specified creature included in a mystery gift.',
        properties: {
          id: {
            type: 'string',
            description: 'Species ID.',
            example: 'pikachu',
          },
          level: { type: 'integer', minimum: 1, maximum: 100, example: 25 },
          shiny: { type: 'boolean' },
          form: { type: 'integer', description: 'Form index.' },
          gender: {
            type: 'integer',
            description: 'Gender value (PSDK convention).',
          },
          nature: { type: 'integer', description: 'Nature index.' },
          ability: {
            description: 'Ability index or string ID.',
            oneOf: [{ type: 'integer' }, { type: 'string' }],
          },
          loyalty: { type: 'integer', minimum: 0, maximum: 255 },
          stats: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Base stats override [hp, atk, def, spd, ats, dfs].',
          },
          bonus: {
            type: 'array',
            items: { type: 'integer' },
            description: 'EV/bonus array.',
          },
          moves: {
            type: 'array',
            items: { type: 'string' },
            description: 'Move IDs.',
          },
          item: {
            description: 'Held item index or string ID.',
            oneOf: [{ type: 'integer' }, { type: 'string' }],
          },
          given_name: { type: 'string', description: 'Nickname.' },
          captured_with: {
            description: 'Poké Ball index or string ID.',
            oneOf: [{ type: 'integer' }, { type: 'string' }],
          },
          captured_in: {
            type: 'integer',
            description: 'Map ID where the creature was caught.',
          },
          trainer_name: { type: 'string', description: 'OT trainer name.' },
          trainer_id: { type: 'integer', description: 'OT trainer ID.' },
        },
      },
      GiftEgg: {
        type: 'object',
        required: ['id'],
        description:
          'An egg included in a mystery gift. Subset of GiftCreature fields — level defaults to 1.',
        properties: {
          id: { type: 'string', example: 'togepi' },
          level: { type: 'integer', minimum: 1, maximum: 100, default: 1 },
          shiny: { type: 'boolean' },
          form: { type: 'integer' },
          gender: { type: 'integer' },
          nature: { type: 'integer' },
          ability: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
          stats: { type: 'array', items: { type: 'integer' } },
          bonus: { type: 'array', items: { type: 'integer' } },
          trainer_name: { type: 'string' },
          trainer_id: { type: 'integer' },
        },
      },
      MysteryGift: {
        type: 'object',
        description:
          'Public view of a Mystery Gift. ' +
          '`claimedBy` and `allowedClaimers` are **never** exposed to players.',
        properties: {
          giftId: {
            type: 'string',
            description:
              'Human-readable unique identifier (auto-generated as `gift-<random>`).',
            example: 'gift-abc12345',
          },
          title: { type: 'string', example: 'Launch Event Gift' },
          type: {
            type: 'string',
            enum: ['code', 'internet'],
            description:
              '`"internet"` — visible in the list, claimed by `giftId`.\n\n' +
              '`"code"` — hidden from the list, claimed by supplying the secret code.',
          },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/GiftItem' },
          },
          creatures: {
            type: 'array',
            items: { $ref: '#/components/schemas/GiftCreature' },
          },
          eggs: {
            type: 'array',
            items: { $ref: '#/components/schemas/GiftEgg' },
          },
          rarity: {
            type: 'integer',
            minimum: 0,
            maximum: 3,
            description:
              'Cosmetic rarity tier. Does not affect claiming logic.\n`0` = common, `1` = uncommon, `2` = rare, `3` = legendary.',
          },
          alwaysAvailable: {
            type: 'boolean',
            description:
              'If `true`, `validFrom`/`validTo` are cleared and the gift never expires.',
          },
          validFrom: { type: 'string', format: 'date-time', nullable: true },
          validTo: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Must be strictly after `validFrom`.',
          },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ClaimBody: {
        type: 'object',
        description:
          'Provide **either** `code` (for `"code"` type gifts) **or** `giftId` (for `"internet"` type gifts). At least one is required.',
        properties: {
          code: {
            type: 'string',
            description:
              'Claim code. Matched case-insensitively (stored uppercase on the server).',
            example: 'LAUNCH2024',
          },
          giftId: {
            type: 'string',
            description: 'The `giftId` field of an internet gift.',
            example: 'gift-abc12345',
          },
        },
      },
      ClaimResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          error: {
            type: 'string',
            description:
              'Failure reason (when `ok` is `false`). Possible values:\n' +
              '- `"Gift not found."`\n' +
              '- `"You have already claimed this gift."`\n' +
              '- `"This gift is not yet available."`\n' +
              '- `"This gift has expired."`\n' +
              '- `"You are not allowed to claim this gift."`\n' +
              '- `"This gift is no longer available (limit reached)."`',
          },
          gift: {
            type: 'object',
            description: 'Full gift contents returned on success.',
            properties: {
              giftId: { type: 'string' },
              title: { type: 'string' },
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/GiftItem' },
              },
              creatures: {
                type: 'array',
                items: { $ref: '#/components/schemas/GiftCreature' },
              },
              eggs: {
                type: 'array',
                items: { $ref: '#/components/schemas/GiftEgg' },
              },
            },
          },
        },
      },
      CreateGiftBody: {
        type: 'object',
        required: ['title', 'type'],
        description:
          'At least one of `items`, `creatures`, or `eggs` must be non-empty.',
        properties: {
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 64,
            example: 'Launch Event Gift',
          },
          type: { type: 'string', enum: ['code', 'internet'] },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/GiftItem' },
            default: [],
          },
          creatures: {
            type: 'array',
            items: { $ref: '#/components/schemas/GiftCreature' },
            default: [],
          },
          eggs: {
            type: 'array',
            items: { $ref: '#/components/schemas/GiftEgg' },
            default: [],
          },
          code: {
            type: 'string',
            minLength: 1,
            maxLength: 32,
            description:
              '**Required** when `type` is `"code"`. Stored and matched **uppercase**.',
            example: 'LAUNCH2024',
          },
          allowedClaimers: {
            type: 'array',
            items: { type: 'string' },
            default: [],
            description:
              'Whitelist of player IDs allowed to claim. Empty array = everyone can claim.',
          },
          maxClaims: {
            type: 'integer',
            minimum: -1,
            default: -1,
            description: 'Maximum total claims. `-1` = unlimited.',
          },
          alwaysAvailable: {
            type: 'boolean',
            default: false,
            description:
              'If `true`, `validFrom`/`validTo` are ignored and cleared on save.',
          },
          validFrom: {
            type: 'string',
            format: 'date-time',
            description:
              'ISO 8601 start date. Ignored if `alwaysAvailable` is true.',
          },
          validTo: {
            type: 'string',
            format: 'date-time',
            description:
              'ISO 8601 end date. Must be strictly after `validFrom`. Ignored if `alwaysAvailable` is true.',
          },
          rarity: { type: 'integer', minimum: 0, maximum: 3, default: 0 },
        },
      },
    },

    responses: {
      Unauthorized: {
        description: 'Invalid or missing `x-api-key` header.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Invalid or missing API Key' },
          },
        },
      },
      MissingPlayerId: {
        description: 'Missing or empty `x-player-id` header.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Missing X-Player-Id header' },
          },
        },
      },
      ValidationError: {
        description: 'Request body failed Zod schema validation.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ValidationError' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },

  security: [{ ApiKey: [] }],

  tags: [
    { name: 'System', description: 'Health check and API metadata.' },
    { name: 'Auth', description: 'Player registration and login.' },
    { name: 'Friends',
      description:
        'Friend list, online presence, heartbeat, and friend requests.',
    },
    {
      name: 'GTS',
      description:
        'Global Trade System — deposit, search, and trade creatures.',
    },
    {
      name: 'Mystery Gift',
      description: 'Claim internet and code-based mystery gifts.',
    },
    {
      name: 'Mystery Gift (Admin)',
      description: 'Admin-only gift management (create, deactivate, purge).',
    },
    {
      name: 'Telemetry',
      description: 'Server telemetry and real-time monitoring.',
    },
    {
      name: 'WebSocket',
      description:
        'Real-time battles and trades over WebSocket (ws://host/ws).',
    },
  ],

  paths: {
    // ── Health ──────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description:
          'Public endpoint — **no `x-api-key` required**. Use it to verify the server is up before making authenticated requests.',
        security: [],
        responses: {
          200: {
            description: 'Server is running.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    uptime: {
                      type: 'integer',
                      description: 'Seconds elapsed since server start.',
                      example: 3600,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Auth ────────────────────────────────────────────────────────────────
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register or re-login',
        description:
          '**First login** → creates the player document, generates a unique 8-digit `friendCode`, returns HTTP **201**.\n\n' +
          '**Re-login** → updates `lastSeen`, optionally updates `trainerName` if it changed, returns HTTP **200**.\n\n' +
          '`playerId` is the primary key and is **never** reassigned. `trainerName` is purely cosmetic and may change freely.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterBody' },
            },
          },
        },
        responses: {
          200: {
            description: 'Player already existed — re-login successful.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterResponse' },
              },
            },
          },
          201: {
            description: 'New player created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterResponse' },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── GTS pending results ──────────────────────────────────────────────────
    '/api/v1/gts/pending': {
      get: {
        tags: ['GTS'],
        summary: 'Get pending trade results (creatures received while offline)',
        description:
          'Returns creatures that were sent to the player by a trader while they were offline.\n\n' +
          'A pending result is created automatically when another player executes a trade ' +
          'against the player\'s GTS deposit. The depositor can preview their received ' +
          'creatures here and claim them one-by-one via `POST /api/v1/gts/pending/claim/:pendingResultId`.\n\n' +
          'Pending results share the same TTL as deposits (`GTS_EXPIRY_DAYS` days).',
        security: [{ ApiKey: [], PlayerId: [] }],
        responses: {
          200: {
            description: 'Array of pending results (may be empty).',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/GtsPendingResult' },
                },
                examples: {
                  hasPending: {
                    summary: 'Has pending results',
                    value: [
                      {
                        _id: '64f1a2b3c4d5e6f7a8b9c0d2',
                        recipientId: 'player-123',
                        receivedCreature: { speciesId: 'blastoise', level: 36 },
                        traderName: 'Gary',
                        expiresAt: '2026-04-06T00:00:00.000Z',
                      },
                    ],
                  },
                  empty: { summary: 'No pending results', value: [] },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/MissingPlayerId' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/gts/pending/claim/{pendingResultId}': {
      post: {
        tags: ['GTS'],
        summary: 'Claim a pending trade result',
        description:
          'Atomically removes the pending result and returns the received creature.\n\n' +
          'Use the `_id` from `GET /api/v1/gts/pending` as `pendingResultId`.\n\n' +
          'The operation fails safely if the result does not exist or belongs to a different player.',
        security: [{ ApiKey: [], PlayerId: [] }],
        parameters: [
          {
            name: 'pendingResultId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'MongoDB `_id` of the pending result to claim.',
            example: '64f1a2b3c4d5e6f7a8b9c0d2',
          },
        ],
        responses: {
          200: {
            description: 'Claimed successfully — creature returned.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GtsPendingClaimResponse' },
                example: {
                  ok: true,
                  creature: { speciesId: 'blastoise', level: 36 },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: {
            description: 'Pending result not found or belongs to another player.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GtsPendingClaimResponse' },
                example: {
                  ok: false,
                  error: 'Pending result not found or does not belong to you',
                },
              },
            },
          },
        },
      },
    },

    // ── Friends ─────────────────────────────────────────────────────────────
    '/api/v1/friends': {
      get: {
        tags: ['Friends'],
        summary: "Get the player's friend list and pending requests",
        description:
          'Returns accepted friends (each annotated with a live `isOnline` flag) and incoming pending requests.\n\n' +
          'A player is **online** if their `lastSeen` is less than **60 seconds** ago.\n\n' +
          'PSDK clients typically poll this route every **~30 seconds**.',
        security: [{ ApiKey: [], PlayerId: [] }],
        responses: {
          200: {
            description: 'Friends and pending requests.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FriendListResponse' },
              },
            },
          },
          400: { $ref: '#/components/responses/MissingPlayerId' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: {
            description: 'Player not registered.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Player not registered' },
              },
            },
          },
        },
      },
    },
    '/api/v1/friends/heartbeat': {
      post: {
        tags: ['Friends'],
        summary: 'Send a heartbeat (mark player as online)',
        description:
          'Updates `lastSeen` to the current UTC time.\n\n' +
          'Call this every **~30 seconds** from the PSDK client to stay visible as online. ' +
          'A player whose `lastSeen` is more than **60 seconds** old is shown as offline by peers.',
        security: [{ ApiKey: [], PlayerId: [] }],
        responses: {
          200: {
            description: 'Heartbeat recorded.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { ok: { type: 'boolean', example: true } },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/MissingPlayerId' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/friends/request/{friendCode}': {
      post: {
        tags: ['Friends'],
        summary: 'Send a friend request',
        description:
          "Adds the requester's `friendCode` to the target player's `pendingRequests`.\n\n" +
          '**Possible `error` values:** `"Player not found"`, `"Cannot add yourself"`, `"This player is already your friend"`, `"A request is already pending"`.',
        security: [{ ApiKey: [], PlayerId: [] }],
        parameters: [
          {
            name: 'friendCode',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: '8-digit friend code of the target player.',
            example: '87654321',
          },
        ],
        responses: {
          200: {
            description: 'Result (check `ok` field).',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OkResult' },
              },
            },
          },
          400: { $ref: '#/components/responses/MissingPlayerId' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/friends/accept/{friendCode}': {
      post: {
        tags: ['Friends'],
        summary: 'Accept a pending friend request',
        description:
          "Creates a **mutual friendship**: both players' `friends` arrays are updated and the request is removed from `pendingRequests`.\n\n" +
          '**Possible `error` values:** `"Player not found"`, `"No request from this friend"`.',
        security: [{ ApiKey: [], PlayerId: [] }],
        parameters: [
          {
            name: 'friendCode',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Friend code of the player who sent the request.',
            example: '87654321',
          },
        ],
        responses: {
          200: {
            description: 'Result (check `ok` field).',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OkResult' },
              },
            },
          },
          400: { $ref: '#/components/responses/MissingPlayerId' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/friends/decline/{friendCode}': {
      post: {
        tags: ['Friends'],
        summary: 'Decline a friend request',
        description:
          'Removes the sender from `pendingRequests`. Always returns `{ ok: true }` — silently no-ops if the request no longer exists.',
        security: [{ ApiKey: [], PlayerId: [] }],
        parameters: [
          {
            name: 'friendCode',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: '87654321',
          },
        ],
        responses: {
          200: {
            description: 'Declined (or was already absent).',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OkResult' },
              },
            },
          },
          400: { $ref: '#/components/responses/MissingPlayerId' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/friends/{friendCode}': {
      delete: {
        tags: ['Friends'],
        summary: 'Remove a friend',
        description:
          "Removes the friendship from **both** players' `friends` arrays symmetrically.",
        security: [{ ApiKey: [], PlayerId: [] }],
        parameters: [
          {
            name: 'friendCode',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: '87654321',
          },
        ],
        responses: {
          200: {
            description: 'Result (check `ok` field).',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OkResult' },
              },
            },
          },
          400: { $ref: '#/components/responses/MissingPlayerId' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── GTS ─────────────────────────────────────────────────────────────────
    '/api/v1/gts/deposit': {
      get: {
        tags: ['GTS'],
        summary: "Get the player's active GTS deposit",
        description:
          "Returns the player's current deposit **including the creature data**, or `null` if they have nothing deposited.",
        security: [{ ApiKey: [], PlayerId: [] }],
        responses: {
          200: {
            description: 'Active deposit (with `creature`) or `null`.',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/GtsMyDeposit' },
                    { type: 'object', nullable: true },
                  ],
                },
                examples: {
                  withDeposit: {
                    summary: 'Has a deposit',
                    value: {
                      _id: '64f1a2b3c4d5e6f7a8b9c0d1',
                      depositorId: 'player-123',
                      depositorName: 'Ash',
                      creature: { speciesId: 'charizard', level: 50 },
                      wantedSpeciesId: 'blastoise',
                      wantedMinLevel: 1,
                      wantedMaxLevel: 100,
                      wantedGender: 'any',
                      expiresAt: '2026-04-06T00:00:00.000Z',
                    },
                  },
                  noDeposit: { summary: 'No active deposit', value: null },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/MissingPlayerId' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['GTS'],
        summary: 'Deposit a creature on the GTS',
        description:
          '**Rules enforced by the server:**\n' +
          '- A player can only have **one active deposit** at a time.\n' +
          '- `creature.speciesId` must not be in `GTS_SPECIES_BLACKLIST`.\n' +
          '- `wanted.speciesId` must not be in `GTS_SPECIES_BLACKLIST`.\n' +
          '- The deposit auto-expires after `GTS_EXPIRY_DAYS` days (default 30) via MongoDB TTL.',
        security: [{ ApiKey: [], PlayerId: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GtsDepositBody' },
            },
          },
        },
        responses: {
          201: {
            description:
              'Deposit created. Use `depositId` to target this deposit in a trade.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GtsDepositResponse' },
              },
            },
          },
          400: {
            description: 'Business error.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GtsDepositResponse' },
                examples: {
                  alreadyDeposited: {
                    value: {
                      ok: false,
                      error: 'You already have a creature deposited on the GTS',
                    },
                  },
                  blacklistedOwn: {
                    value: {
                      ok: false,
                      error: 'This species cannot be deposited on the GTS',
                    },
                  },
                  blacklistedWant: {
                    value: {
                      ok: false,
                      error: 'This species cannot be requested on the GTS',
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      delete: {
        tags: ['GTS'],
        summary: 'Withdraw your creature from the GTS',
        description:
          "Cancels the player's active deposit and returns the creature.",
        security: [{ ApiKey: [], PlayerId: [] }],
        responses: {
          200: {
            description: 'Withdrawal succeeded — creature returned.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GtsWithdrawResponse' },
                example: {
                  ok: true,
                  creature: { speciesId: 'charizard', level: 50 },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: {
            description: 'No active deposit found.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GtsWithdrawResponse' },
                example: { ok: false, error: 'No active deposit found' },
              },
            },
          },
        },
      },
    },
    '/api/v1/gts/search': {
      get: {
        tags: ['GTS'],
        summary: 'Search GTS deposits compatible with your offer',
        description:
          'Returns deposits whose `wantedSpeciesId` matches your offer and whose level/gender constraints are met.\n\n' +
          'The **`creature` field is omitted** from results — it is only revealed after a successful trade, preventing sniping.\n\n' +
          'Results are paginated: 20 per page. Use `page` (zero-based) to navigate.',
        security: [{ ApiKey: [], PlayerId: [] }],
        parameters: [
          {
            name: 'speciesId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Species ID you want to offer.',
            example: 'charmander',
          },
          {
            name: 'level',
            in: 'query',
            required: true,
            schema: { type: 'integer', minimum: 1, maximum: 100 },
            description: 'Level of your offered creature.',
            example: 36,
          },
          {
            name: 'gender',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: ['male', 'female'] },
            description: 'Gender of your offered creature.',
          },
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 0, default: 0 },
            description: 'Zero-based page index (20 results per page).',
          },
        ],
        responses: {
          200: {
            description: 'Matching deposits (creature data excluded).',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/GtsDepositEntry' },
                },
              },
            },
          },
          400: {
            description:
              'Missing required query parameters or missing `x-player-id`.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: 'Required parameters: speciesId, level, gender',
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/gts/trade/{depositId}': {
      post: {
        tags: ['GTS'],
        summary: 'Trade your creature for a GTS deposit',
        description:
          'Validates the offered creature against the deposit constraints then atomically swaps them.\n\n' +
          '**Validation rules (server-side):**\n' +
          '1. `offeredCreature.speciesId` must equal `wantedSpeciesId`.\n' +
          '2. `offeredCreature.level` must be within `[wantedMinLevel, wantedMaxLevel]`.\n' +
          '3. `offeredCreature.gender` must match `wantedGender` (skipped when `wantedGender` is `"any"`).\n' +
          '4. A player cannot trade with their own deposit.\n\n' +
          'On success the deposit document is **permanently deleted** and the deposited creature is returned to you.',
        security: [{ ApiKey: [], PlayerId: [] }],
        parameters: [
          {
            name: 'depositId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'The `_id` field from a search result.',
            example: '64f1a2b3c4d5e6f7a8b9c0d1',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GtsTradeBody' },
            },
          },
        },
        responses: {
          200: {
            description: 'Trade completed — received creature returned.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GtsTradeResponse' },
                example: {
                  ok: true,
                  receivedCreature: { speciesId: 'blastoise', level: 36 },
                },
              },
            },
          },
          400: {
            description: 'Business error.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GtsTradeResponse' },
                examples: {
                  notFound: {
                    value: { ok: false, error: 'Deposit not found or expired' },
                  },
                  selfTrade: {
                    value: { ok: false, error: 'Cannot trade with yourself' },
                  },
                  speciesMismatch: {
                    value: {
                      ok: false,
                      error: 'The offered species does not match the request',
                    },
                  },
                  levelMismatch: {
                    value: {
                      ok: false,
                      error:
                        'The offered creature level is outside the requested range',
                    },
                  },
                  genderMismatch: {
                    value: {
                      ok: false,
                      error:
                        'The offered creature gender does not match the request',
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── Mystery Gift ─────────────────────────────────────────────────────────
    '/api/v1/mystery-gift': {
      get: {
        tags: ['Mystery Gift'],
        summary: 'List available internet gifts for the player',
        description:
          'Returns `"internet"`-type gifts the player has not yet claimed and is eligible to receive.\n\n' +
          '**Server-side filtering:**\n' +
          '- `isActive` must be `true`.\n' +
          '- `type` must be `"internet"` (code gifts are invisible here).\n' +
          '- Player must not already be in `claimedBy`.\n' +
          '- Either `alwaysAvailable: true`, or `now` falls within `[validFrom, validTo]`.\n' +
          "- `allowedClaimers` is empty (open to all) or contains the player's ID.\n\n" +
          '`claimedBy` and `allowedClaimers` are **never** returned.',
        security: [{ ApiKey: [], PlayerId: [] }],
        responses: {
          200: {
            description: 'Array of available gifts (may be empty).',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/MysteryGift' },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/MissingPlayerId' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/mystery-gift/claim': {
      post: {
        tags: ['Mystery Gift'],
        summary: 'Claim a mystery gift',
        description:
          'Claims a gift by code (code-type) or by `giftId` (internet-type).\n\n' +
          '- **Code gifts**: pass `body.code` (case-insensitive, stored uppercase).\n' +
          '- **Internet gifts**: pass `body.giftId`.\n\n' +
          'Claiming uses `$addToSet` atomically — safe against race conditions.\n\n' +
          'On success the full contents (`items`, `creatures`, `eggs`) are returned.',
        security: [{ ApiKey: [], PlayerId: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ClaimBody' },
            },
          },
        },
        responses: {
          200: {
            description:
              'Gift claimed or business error (always check the `ok` field).',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ClaimResponse' },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/api/v1/mystery-gift/admin/create': {
      post: {
        tags: ['Mystery Gift (Admin)'],
        summary: 'Create a new mystery gift',
        description:
          'Creates a gift in the database. Requires `x-admin-key` (no `x-player-id`).\n\n' +
          '**Constraints:**\n' +
          '- At least one of `items`, `creatures`, or `eggs` must be non-empty.\n' +
          '- `code` is **required** when `type` is `"code"` — stored and matched uppercase.\n' +
          '- `validTo` must be strictly after `validFrom`.\n' +
          '- If `alwaysAvailable` is `true`, `validFrom`/`validTo` are cleared on save.',
        security: [{ AdminKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateGiftBody' },
            },
          },
        },
        responses: {
          201: {
            description: 'Gift created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MysteryGift' },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/mystery-gift/admin/{giftId}': {
      delete: {
        tags: ['Mystery Gift (Admin)'],
        summary: 'Deactivate a gift (soft delete)',
        security: [{ AdminKey: [] }],
        description:
          'Sets `isActive` to `false`. The document is **preserved** in the database for audit purposes.',
        parameters: [
          {
            name: 'giftId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description:
              'The human-readable `giftId` field (e.g. `gift-abc12345`).',
            example: 'gift-abc12345',
          },
        ],
        responses: {
          200: {
            description: 'Gift deactivated.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OkResult' },
                example: { ok: true },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: {
            description: 'Gift not found.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OkResult' },
                example: { ok: false, error: 'Gift not found.' },
              },
            },
          },
        },
      },
    },
    '/api/v1/mystery-gift/admin/purge': {
      post: {
        tags: ['Mystery Gift (Admin)'],
        summary: 'Permanently delete expired gifts',
        security: [{ AdminKey: [] }],
        description:
          'Hard-deletes all gifts where `alwaysAvailable` is `false` **and** `validTo < now`.\n\n' +
          'Note: Mystery gifts do **not** have a MongoDB TTL index (unlike GTS deposits). ' +
          'This endpoint is the manual cleanup mechanism.',
        responses: {
          200: {
            description: 'Number of permanently deleted gifts.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { deleted: { type: 'integer', example: 3 } },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── Telemetry ────────────────────────────────────────────────────────────
    '/telemetry/summary': {
      get: {
        tags: ['Telemetry'],
        summary: 'Global server summary',
        security: [{ AdminKey: [] }],
        description:
          'Aggregated counters: total HTTP requests, error count, WS connections, DB queries, etc.',
        responses: {
          200: { description: 'Telemetry summary object.' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/telemetry/routes': {
      get: {
        tags: ['Telemetry'],
        summary: 'Per-route HTTP stats',
        security: [{ AdminKey: [] }],
        description:
          'Hit count, error count, and average latency broken down per HTTP route pattern.',
        responses: {
          200: { description: 'Array of route stat objects.' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/telemetry/ws-types': {
      get: {
        tags: ['Telemetry'],
        summary: 'Per-type WebSocket message stats',
        security: [{ AdminKey: [] }],
        description:
          'Message counts grouped by `WsMessageType` (e.g. `BATTLE_CHALLENGE`, `TRADE_OFFER`).',
        responses: {
          200: { description: 'Array of WS type stat objects.' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/telemetry/ws-clients': {
      get: {
        tags: ['Telemetry'],
        summary: 'Currently connected WebSocket clients',
        security: [{ AdminKey: [] }],
        description:
          'Snapshot of the in-memory `clients` map at the time of the request.',
        responses: {
          200: {
            description: 'List of connected players.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      playerId: { type: 'string' },
                      trainerName: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/telemetry/events': {
      get: {
        tags: ['Telemetry'],
        summary: 'Recent telemetry events (ring buffer)',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
            description: 'Max events to return (hard cap: 200).',
          },
        ],
        responses: {
          200: { description: 'Recent events array.' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/telemetry/snapshots': {
      get: {
        tags: ['Telemetry'],
        summary: 'Hourly snapshots (last 7 days)',
        security: [{ AdminKey: [] }],
        description:
          'Merges **in-memory** snapshots (most recent 24 h) with **MongoDB** snapshots (last 7 days), ' +
          'deduplicating by hour and sorting chronologically.\n\n' +
          'Each snapshot contains: `hour` (ms epoch), `httpCount`, `httpErrors`, `wsMessages`, `wsConnects`, `dbQueries`, `dbErrors`, `avgLatencyMs`.',
        responses: {
          200: { description: 'Sorted array of hourly snapshot objects.' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── WebSocket ────────────────────────────────────────────────────────────
    '/ws': {
      get: {
        tags: ['WebSocket'],
        summary: 'WebSocket connection endpoint',
        description: `
Connect with: \`ws://<host>/ws?apiKey=<key>&playerId=<id>&trainerName=<encoded-name>\`

**Handshake query parameters:**
| Parameter | Required | Description |
|---|---|---|
| \`apiKey\` | ✅ | Server API key. Connection closed with code **4001** if invalid. |
| \`playerId\` | ✅ | Game-side player ID. Closed with code **4002** if missing. |
| \`trainerName\` | ❌ | URL-encoded display name. Defaults to \`"Trainer"\`. |

If the same \`playerId\` reconnects, the **previous session is closed** with code **4003**.

---

## Message envelope
All messages (client→server and server→client) use this format:
\`\`\`json
{ "type": "<TYPE>", "payload": { … } }
\`\`\`

---

## Battle messages

### \`BATTLE_CHALLENGE\` *(client → server)*
Challenge another online player to a battle.
\`\`\`json
{ "type": "BATTLE_CHALLENGE", "payload": { "targetPlayerId": "opponent-player-id" } }
\`\`\`
**Errors (ERROR message sent back):** player not found/offline · you are already in a battle · a challenge is already pending.

### \`BATTLE_CHALLENGE\` *(server → target player)*
Received by the challenged player.
\`\`\`json
{ "type": "BATTLE_CHALLENGE", "payload": { "challengerId": "challenger-id", "challengerName": "Ash" } }
\`\`\`

### \`BATTLE_ACCEPT\` *(client → server)*
Accept a pending challenge. Creates the battle room; both players receive \`BATTLE_STATE\`.
\`\`\`json
{ "type": "BATTLE_ACCEPT", "payload": { "challengerId": "challenger-player-id" } }
\`\`\`

### \`BATTLE_DECLINE\` *(client → server)*
Decline a pending challenge.
\`\`\`json
{ "type": "BATTLE_DECLINE", "payload": { "challengerId": "challenger-player-id" } }
\`\`\`
The challenger receives a \`BATTLE_DECLINE\` notification.

### \`BATTLE_ACTION\` *(client → server)*
Submit a battle action. The action is relayed to the opponent; turn advances to the opponent.
\`\`\`json
{ "type": "BATTLE_ACTION", "payload": { "action": <any PSDK battle action object> } }
\`\`\`

### \`BATTLE_STATE\` *(server → both players)*
Broadcast after the room is created and after each action.
\`\`\`json
{ "type": "BATTLE_STATE", "payload": { "roomId": "battle_<ts>_<rand>", "turn": "current-player-id", "state": "active" } }
\`\`\`

### \`BATTLE_END\` *(client → server)*
Terminate the battle room. Both players receive a \`BATTLE_END\` notification and the room is deleted.

---

## Trade messages

### \`TRADE_REQUEST\` *(client → server)*
Propose a trade to another online player.
\`\`\`json
{ "type": "TRADE_REQUEST", "payload": { "targetPlayerId": "opponent-player-id" } }
\`\`\`

### \`TRADE_REQUEST\` *(server → target player)*
\`\`\`json
{ "type": "TRADE_REQUEST", "payload": { "requesterId": "requester-id", "requesterName": "Ash" } }
\`\`\`

### \`TRADE_ACCEPT\` *(client → server)*
Accept a pending trade request. Opens the trade session.
\`\`\`json
{ "type": "TRADE_ACCEPT", "payload": { "requesterId": "requester-player-id" } }
\`\`\`

### \`TRADE_DECLINE\` *(client → server)*
Decline a pending trade request.
\`\`\`json
{ "type": "TRADE_DECLINE", "payload": { "requesterId": "requester-player-id" } }
\`\`\`

### \`TRADE_OFFER\` *(client → server)*
Place or **update** your creature on the trade table. **Resets both players' confirmations.**
\`\`\`json
{ "type": "TRADE_OFFER", "payload": { "creature": { … } } }
\`\`\`
Both players receive a \`TRADE_OFFER\` broadcast with the updated table.

### \`TRADE_CONFIRM\` *(client → server)*
Lock in the current offers. When **both** players have confirmed, the trade executes automatically and both receive \`TRADE_COMPLETE\`.

### \`TRADE_CANCEL\` *(client → server)*
Abort the ongoing trade session. The opponent receives a \`TRADE_CANCEL\` notification.

### \`TRADE_COMPLETE\` *(server → both players)*
Trade executed — each player receives the creature offered by the other.
\`\`\`json
{ "type": "TRADE_COMPLETE", "payload": { "yourCreature": { … } } }
\`\`\`

---

## System messages

### \`PING\` *(client → server)*
Keepalive probe. The server replies immediately with \`PONG\`.

### \`PONG\` *(server → client)*
Keepalive response.

### \`ERROR\` *(server → client)*
Sent whenever a message cannot be processed.
\`\`\`json
{ "type": "ERROR", "payload": { "message": "Descriptive error message" } }
\`\`\`
        `.trim(),
        responses: {
          101: {
            description:
              'Switching Protocols — WebSocket connection established.',
          },
          400: {
            description:
              'Missing `playerId` query parameter (close code **4002**).',
          },
          401: {
            description:
              'Invalid `apiKey` query parameter (close code **4001**).',
          },
        },
      },
    },
  },
};

// ── Custom API Docs HTML ──────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';

const API_DOCS_HTML = path.resolve(
  process.cwd(),
  'src/telemetry/api-docs.html',
);

/**
 * Returns the custom API documentation HTML page.
 * Falls back to a minimal error page if the file is missing.
 */
export function swaggerUiHtml(): string {
  try {
    return fs.readFileSync(API_DOCS_HTML, 'utf-8');
  } catch {
    return '<h1>API docs HTML not found</h1>';
  }
}
