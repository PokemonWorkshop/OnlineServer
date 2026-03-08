import { telemetry, HourlySnapshot } from './store';
import { TelemetrySnapshot } from '../models/TelemetrySnapshot';

const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
let flushTimer: NodeJS.Timeout | null = null;

/**
 * Called at startup — loads the last 24 hourly snapshots from MongoDB
 * to pre-fill the graphs without waiting for one hour of runtime.
 */
export async function restoreTelemetryFromDb(): Promise<void> {
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000); // last 24 hours
    const docs = await TelemetrySnapshot.find({ hour: { $gte: since } })
      .sort({ hour: 1 })
      .lean<
        {
          hour: Date;
          httpCount: number;
          httpErrors: number;
          wsMessages: number;
          wsConnects: number;
          dbQueries: number;
          dbErrors: number;
          avgLatencyMs: number;
        }[]
      >();

    if (!docs.length) return;

    // Inject the snapshots into the in-memory store
    const store = telemetry as any;
    const snaps: HourlySnapshot[] = docs.map((d) => ({
      hour: d.hour.getTime(),
      httpCount: d.httpCount,
      httpErrors: d.httpErrors,
      wsMessages: d.wsMessages,
      wsConnects: d.wsConnects,
      dbQueries: d.dbQueries,
      dbErrors: d.dbErrors,
      avgLatencyMs: d.avgLatencyMs,
    }));

    store.snapshots = snaps;
    console.log(`[Telemetry] Restored ${snaps.length} snapshots from MongoDB`);
  } catch (err) {
    console.error('[Telemetry] Error restoring snapshots:', err);
  }
}

/**
 * Starts the periodic flush of hourly snapshots to MongoDB.
 * Uses upsert on the `hour` field to prevent duplicates.
 */
export function startTelemetryPersist(): void {
  if (flushTimer) return;

  flushTimer = setInterval(async () => {
    await flushTelemetryToDb();
  }, FLUSH_INTERVAL_MS);

  // Initial flush immediately
  flushTelemetryToDb().catch(console.error);
  console.log('[Telemetry] Persistence enabled (flush every 5 minutes)');
}

/** Stops the periodic persistence of telemetry snapshots. */
export function stopTelemetryPersist(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/**
 * Flushes the in-memory telemetry snapshots to MongoDB.
 */
export async function flushTelemetryToDb(): Promise<void> {
  try {
    const snapshots = telemetry.getSnapshots();
    if (!snapshots.length) return;

    const ops = snapshots.map((s) => ({
      updateOne: {
        filter: { hour: new Date(s.hour) },
        update: {
          $set: {
            httpCount: s.httpCount,
            httpErrors: s.httpErrors,
            wsMessages: s.wsMessages,
            wsConnects: s.wsConnects,
            dbQueries: s.dbQueries,
            dbErrors: s.dbErrors,
            avgLatencyMs: s.avgLatencyMs,
          },
        },
        upsert: true,
      },
    }));

    await TelemetrySnapshot.bulkWrite(ops);
  } catch (err) {
    console.error('[Telemetry] Error flushing to MongoDB:', err);
  }
}
