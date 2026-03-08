import { Schema, model, Document, Types } from 'mongoose';

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * Persisted hourly telemetry snapshot.
 *
 * @remarks
 * One document is written per calendar hour. The `hour` field stores the
 * UTC timestamp of the start of that hour and acts as the unique key.
 * Documents are automatically purged after 7 days via the TTL index.
 *
 * The in-memory counterpart is {@link HourlySnapshot} in `telemetry/store.ts`.
 * Data flows: in-memory store → {@link flushTelemetryToDb} (every 5 min) → this collection.
 */
export interface ITelemetrySnapshot extends Document {
  _id:          Types.ObjectId;
  /** Start of the hour (UTC), rounded to the nearest full hour. Unique key. */
  hour:         Date;
  /** Total HTTP requests processed during this hour (excludes telemetry/health routes). */
  httpCount:    number;
  /** HTTP requests that returned a status ≥ 400. */
  httpErrors:   number;
  /** Incoming WebSocket messages processed (excludes `PING`). */
  wsMessages:   number;
  /** New WebSocket connections established. */
  wsConnects:   number;
  /** MongoDB queries executed (excludes telemetry collection). */
  dbQueries:    number;
  /** MongoDB queries that resulted in an error. */
  dbErrors:     number;
  /** Approximate average HTTP response time in milliseconds. */
  avgLatencyMs: number;
  createdAt:    Date;
  updatedAt:    Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const TelemetrySnapshotSchema = new Schema<ITelemetrySnapshot>(
  {
    hour:         { type: Date,   required: true, unique: true, index: true },
    httpCount:    { type: Number, default: 0 },
    httpErrors:   { type: Number, default: 0 },
    wsMessages:   { type: Number, default: 0 },
    wsConnects:   { type: Number, default: 0 },
    dbQueries:    { type: Number, default: 0 },
    dbErrors:     { type: Number, default: 0 },
    avgLatencyMs: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// TTL index — automatically removes snapshots older than 7 days
TelemetrySnapshotSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

// ─── Model ────────────────────────────────────────────────────────────────────

export const TelemetrySnapshot = model<ITelemetrySnapshot>(
  'TelemetrySnapshot',
  TelemetrySnapshotSchema,
);
