/**
 * @file Telemetry Store — entirely in-memory, zero external dependencies.
 *
 * Exposes a singleton {@link telemetry} that collects:
 *   - Global counters (HTTP requests, WS connections, DB queries, errors…)
 *   - Per-route HTTP latency histograms with 7 fixed latency buckets
 *   - Per-message-type WS stats
 *   - A ring buffer of the last {@link RING_SIZE} events
 *   - Rolling 24-hour hourly snapshots for dashboard graphs
 *
 * @remarks
 * No file I/O occurs here. Persistence is handled separately by
 * `telemetry/persist.ts` which flushes snapshots to MongoDB every 5 minutes.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Category of a telemetry event. */
export type EventKind = 'http' | 'ws' | 'error' | 'db';

/**
 * A single telemetry event stored in the ring buffer.
 */
export interface TelemetryEvent {
  /** Unix timestamp (ms) when the event was recorded. */
  ts:      number;
  kind:    EventKind;
  /** Human-readable label (e.g. `"GET /api/v1/gts/deposit"`, `"BATTLE_CHALLENGE"`). */
  label:   string;
  /** Duration in milliseconds — present for HTTP and DB events. */
  ms?:     number;
  /** HTTP status code — present for HTTP events only. */
  status?: number;
  /** Arbitrary extra data (playerId, isError, etc.). */
  meta?:   Record<string, unknown>;
}

/**
 * Aggregated stats for a single normalised HTTP route.
 *
 * @remarks
 * `buckets` maps to latency ranges:
 * index 0 → < 10 ms,  1 → < 50 ms,  2 → < 100 ms,
 * index 3 → < 250 ms, 4 → < 500 ms, 5 → < 1 000 ms, 6 → ≥ 1 000 ms.
 */
export interface RouteStats {
  count:   number;
  /** Number of requests that returned status ≥ 400. */
  errors:  number;
  totalMs: number;
  minMs:   number;
  maxMs:   number;
  buckets: [number, number, number, number, number, number, number];
}

/**
 * Aggregated metrics for one calendar hour.
 * Persisted to MongoDB by `telemetry/persist.ts`.
 */
export interface HourlySnapshot {
  /** UTC timestamp of the start of this hour (ms). */
  hour:         number;
  httpCount:    number;
  httpErrors:   number;
  wsMessages:   number;
  wsConnects:   number;
  dbQueries:    number;
  dbErrors:     number;
  avgLatencyMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Number of events kept in the ring buffer. */
const RING_SIZE      = 200;
/** Number of hourly snapshots kept in memory (rolling window). */
const SNAPSHOT_HOURS = 24;
/** Upper bounds of each latency bucket in milliseconds. */
const BUCKET_LIMITS  = [10, 50, 100, 250, 500, 1000] as const;

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * In-memory telemetry store.
 *
 * @remarks
 * All public `record*` methods are synchronous and non-blocking — safe to call
 * from any request/event handler without `await`.
 *
 * The `readonly` counters object allows external code to read raw values
 * directly, but mutation must go through the `record*` methods.
 */
class TelemetryStore {

  // ── Global counters ───────────────────────────────────────────────────────

  /**
   * Raw event counters since server startup.
   * Read-only from outside; mutated only by `record*` methods.
   */
  readonly counters = {
    httpRequests:   0,
    httpErrors:     0,
    wsConnects:     0,
    wsDisconnects:  0,
    wsMessages:     0,
    wsErrors:       0,
    dbQueries:      0,
    dbErrors:       0,
    uncaughtErrors: 0,
  };

  // ── Per-route and per-type stats ──────────────────────────────────────────

  /** Aggregated HTTP stats keyed by normalised route (`METHOD /path/:id`). */
  readonly routeStats  = new Map<string, RouteStats>();
  /** Aggregated WS message stats keyed by message type. */
  readonly wsTypeStats = new Map<string, { count: number; errors: number }>();

  // ── Ring buffer ───────────────────────────────────────────────────────────

  private ring:     TelemetryEvent[] = [];
  private ringHead  = 0;

  // ── Hourly snapshots ──────────────────────────────────────────────────────

  private snapshots:   HourlySnapshot[] = [];
  private currentHour = 0;
  private hourBucket:  HourlySnapshot | null = null;

  // ── Startup time ──────────────────────────────────────────────────────────

  /** Unix timestamp (ms) when the store was initialised. */
  readonly startedAt = Date.now();

  // ─────────────────────────────────────────────────────────────────────────
  //  Recording — public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Records a completed HTTP request.
   *
   * @remarks
   * The pathname is normalised (ObjectIds, UUIDs, and friend codes are replaced
   * with `:id`, `:uuid`, `:fc`) before being stored as the route key.
   *
   * @param method   - HTTP method (`GET`, `POST`, …).
   * @param pathname - Request path (without query string).
   * @param status   - HTTP response status code.
   * @param ms       - Total round-trip duration in milliseconds.
   */
  recordHttp(method: string, pathname: string, status: number, ms: number): void {
    this.counters.httpRequests++;
    if (status >= 400) this.counters.httpErrors++;

    const route = `${method} ${normalizePath(pathname)}`;
    let rs = this.routeStats.get(route);
    if (!rs) {
      rs = { count: 0, errors: 0, totalMs: 0, minMs: Infinity, maxMs: 0, buckets: [0,0,0,0,0,0,0] };
      this.routeStats.set(route, rs);
    }
    rs.count++;
    if (status >= 400) rs.errors++;
    rs.totalMs += ms;
    rs.minMs    = Math.min(rs.minMs, ms);
    rs.maxMs    = Math.max(rs.maxMs, ms);
    rs.buckets[latencyBucket(ms)]++;

    this.pushEvent({ ts: Date.now(), kind: 'http', label: route, ms, status });
    this.tickHour({ http: 1, httpErr: status >= 400 ? 1 : 0, latMs: ms });
  }

  /**
   * Records a new WebSocket connection.
   * @param playerId - ID of the connecting player.
   */
  recordWsConnect(playerId: string): void {
    this.counters.wsConnects++;
    this.pushEvent({ ts: Date.now(), kind: 'ws', label: 'CONNECT', meta: { playerId } });
    this.tickHour({ wsConnect: 1 });
  }

  /**
   * Records a WebSocket disconnection.
   * @param playerId - ID of the disconnecting player.
   * @param code     - WebSocket close code.
   */
  recordWsDisconnect(playerId: string, code: number): void {
    this.counters.wsDisconnects++;
    this.pushEvent({ ts: Date.now(), kind: 'ws', label: 'DISCONNECT', meta: { playerId, code } });
  }

  /**
   * Records an incoming WebSocket message and updates per-type stats.
   * @param type     - Message type string (e.g. `"BATTLE_CHALLENGE"`).
   * @param playerId - Sender's player ID.
   */
  recordWsMessage(type: string, playerId: string): void {
    this.counters.wsMessages++;
    let st = this.wsTypeStats.get(type);
    if (!st) { st = { count: 0, errors: 0 }; this.wsTypeStats.set(type, st); }
    st.count++;
    this.pushEvent({ ts: Date.now(), kind: 'ws', label: type, meta: { playerId } });
    this.tickHour({ wsMsg: 1 });
  }

  /**
   * Records a WebSocket-level error and increments the error count for the
   * associated message type (if known).
   *
   * @param playerId - Player whose socket produced the error.
   * @param msg      - Short error description.
   */
  recordWsError(playerId: string, msg: string): void {
    this.counters.wsErrors++;
    const type = msg.split(':')[0] || 'WS_ERROR';
    const st   = this.wsTypeStats.get(type);
    if (st) st.errors++;
    this.pushEvent({ ts: Date.now(), kind: 'error', label: '[WS] ' + msg, meta: { playerId } });
  }

  /**
   * Records a MongoDB query execution (success or failure).
   *
   * @param collection - Collection name (e.g. `"players"`).
   * @param op         - Mongoose operation name (e.g. `"findOne"`).
   * @param ms         - Query duration in milliseconds.
   * @param isError    - `true` if the query threw an error.
   */
  recordDbQuery(collection: string, op: string, ms: number, isError = false): void {
    this.counters.dbQueries++;
    if (isError) this.counters.dbErrors++;
    this.pushEvent({ ts: Date.now(), kind: 'db', label: `${op} ${collection}`, ms, meta: { isError } });
    this.tickHour({ db: 1, dbErr: isError ? 1 : 0 });
  }

  /**
   * Records an uncaught exception or unhandled promise rejection.
   *
   * @param source  - Origin label (e.g. `"uncaughtException"`).
   * @param message - Error message.
   */
  recordError(source: string, message: string): void {
    this.counters.uncaughtErrors++;
    this.pushEvent({ ts: Date.now(), kind: 'error', label: `[${source}] ${message}` });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Reading — public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns the most recent events from the ring buffer in chronological order.
   * @param limit - Maximum number of events (capped at {@link RING_SIZE}).
   */
  getRecentEvents(limit = 50): TelemetryEvent[] {
    return this.getRingOrdered().slice(-Math.min(limit, RING_SIZE));
  }

  /**
   * Returns HTTP route stats sorted by request count descending,
   * augmented with a pre-computed `avgMs` field.
   */
  getRouteStatsArray(): Array<RouteStats & { route: string; avgMs: number }> {
    return Array.from(this.routeStats.entries())
      .map(([route, s]) => ({ route, ...s, avgMs: s.count ? Math.round(s.totalMs / s.count) : 0 }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Returns WS message-type stats sorted by count descending.
   */
  getWsTypeStatsArray(): Array<{ type: string; count: number; errors: number }> {
    return Array.from(this.wsTypeStats.entries())
      .map(([type, s]) => ({ type, ...s }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Returns a copy of the hourly snapshots after flushing the current bucket.
   *
   * @remarks
   * Always call this before persisting — it ensures the in-progress hour is
   * included in the returned array.
   */
  getSnapshots(): HourlySnapshot[] {
    this.flushHour();
    return [...this.snapshots];
  }

  /**
   * Returns a summary object suitable for the telemetry dashboard header.
   *
   * @remarks
   * `wsConnected` is derived as `wsConnects - wsDisconnects` and may be
   * slightly inaccurate if the server restarted mid-session.
   */
  getSummary() {
    const uptimeMs  = Date.now() - this.startedAt;
    const reqPerMin = this.counters.httpRequests / Math.max(1, uptimeMs / 60_000);
    const errorRate = this.counters.httpRequests
      ? ((this.counters.httpErrors / this.counters.httpRequests) * 100).toFixed(1)
      : '0.0';
    const totalRouteMs = Array.from(this.routeStats.values()).reduce((s, r) => s + r.totalMs, 0);
    const avgLatency   = this.counters.httpRequests ? Math.round(totalRouteMs / this.counters.httpRequests) : 0;

    return {
      uptime:      uptimeMs,
      startedAt:   this.startedAt,
      reqPerMin:   Math.round(reqPerMin * 100) / 100,
      errorRate,
      avgLatency,
      wsConnected: this.counters.wsConnects - this.counters.wsDisconnects,
      ...this.counters,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Internal helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** @internal Appends an event to the ring buffer, overwriting the oldest entry when full. */
  private pushEvent(ev: TelemetryEvent): void {
    if (this.ring.length < RING_SIZE) {
      this.ring.push(ev);
    } else {
      this.ring[this.ringHead] = ev;
      this.ringHead = (this.ringHead + 1) % RING_SIZE;
    }
  }

  /** @internal Returns ring buffer contents in chronological order. */
  private getRingOrdered(): TelemetryEvent[] {
    if (this.ring.length < RING_SIZE) return [...this.ring];
    return [...this.ring.slice(this.ringHead), ...this.ring.slice(0, this.ringHead)];
  }

  /**
   * @internal Accumulates deltas into the current hourly bucket,
   * rolling over to a new bucket when the clock hour changes.
   */
  private tickHour(delta: {
    http?: number; httpErr?: number; latMs?: number;
    wsMsg?: number; wsConnect?: number;
    db?: number; dbErr?: number;
  }): void {
    const hour = Math.floor(Date.now() / 3_600_000) * 3_600_000;

    if (hour !== this.currentHour) {
      this.flushHour();
      this.currentHour = hour;
      this.hourBucket  = { hour, httpCount: 0, httpErrors: 0, wsMessages: 0, wsConnects: 0, dbQueries: 0, dbErrors: 0, avgLatencyMs: 0 };
    }

    if (!this.hourBucket) {
      this.currentHour = hour;
      this.hourBucket  = { hour, httpCount: 0, httpErrors: 0, wsMessages: 0, wsConnects: 0, dbQueries: 0, dbErrors: 0, avgLatencyMs: 0 };
    }

    const b = this.hourBucket;
    if (delta.http)      b.httpCount  += delta.http;
    if (delta.httpErr)   b.httpErrors += delta.httpErr;
    if (delta.wsMsg)     b.wsMessages += delta.wsMsg;
    if (delta.wsConnect) b.wsConnects += delta.wsConnect;
    if (delta.db)        b.dbQueries  += delta.db;
    if (delta.dbErr)     b.dbErrors   += delta.dbErr;
    if (delta.latMs !== undefined) {
      // Approximate moving average — accurate enough for dashboard display
      b.avgLatencyMs = b.httpCount > 1
        ? Math.round((b.avgLatencyMs * (b.httpCount - 1) + delta.latMs) / b.httpCount)
        : delta.latMs;
    }
  }

  /**
   * @internal Moves the current bucket into the snapshots array and enforces
   * the rolling {@link SNAPSHOT_HOURS} window.
   */
  private flushHour(): void {
    if (!this.hourBucket) return;
    this.snapshots.push(this.hourBucket);
    if (this.snapshots.length > SNAPSHOT_HOURS) this.snapshots.shift();
    this.hourBucket = null;
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Replaces dynamic path segments with generic placeholders so that routes
 * with different IDs are aggregated under the same key.
 *
 * | Pattern              | Replacement |
 * |----------------------|-------------|
 * | 24-char hex (Mongo)  | `:id`       |
 * | 36-char UUID         | `:uuid`     |
 * | `XXXX-XXXX-XXXX` FC  | `:fc`       |
 *
 * @internal
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{24}/gi,                       '/:id')
    .replace(/\/[0-9a-f-]{36}/gi,                      '/:uuid')
    .replace(/\/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/gi, '/:fc');
}

/**
 * Maps a latency value to its bucket index.
 *
 * @param ms - Duration in milliseconds.
 * @returns Index 0–6 corresponding to {@link BUCKET_LIMITS}.
 * @internal
 */
function latencyBucket(ms: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  for (let i = 0; i < BUCKET_LIMITS.length; i++) {
    if (ms < BUCKET_LIMITS[i]) return i as 0 | 1 | 2 | 3 | 4 | 5;
  }
  return 6;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Application-wide telemetry store singleton.
 *
 * @example
 * ```ts
 * import { telemetry } from './telemetry/store';
 * telemetry.recordHttp('GET', '/api/v1/friends', 200, 12);
 * ```
 */
export const telemetry = new TelemetryStore();

/**
 * Exposes the internal snapshots array for use by the persistence layer.
 *
 * @remarks
 * This bypasses TypeScript's `private` visibility intentionally — the
 * persistence module needs direct write access to restore snapshots from DB.
 * Do **not** use this function outside of `telemetry/persist.ts`.
 *
 * @internal
 */
export function getSnapshotsForPersist(): HourlySnapshot[] {
  return (telemetry as any).snapshots as HourlySnapshot[];
}
