import mongoose from 'mongoose';
import { ENV } from './env';
import { PlayerService } from '../services/PlayerService';

/**
 * Opens the Mongoose connection to MongoDB and registers reconnection listeners.
 *
 * @remarks
 * Call this once at server startup **before** registering any routes or plugins.
 * The process exits with code `1` if the initial connection fails so that the
 * container/supervisor can restart it.
 *
 * @returns A promise that resolves when the connection is ready.
 * @throws Will call `process.exit(1)` on connection failure.
 *
 * @example
 * ```ts
 * await connectDatabase();
 * installDbTelemetry(); // must come after
 * ```
 */
export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(ENV.MONGODB_URI);
    console.log('[DB] MongoDB connected successfully');

    // Synchronise all model indexes (creates missing ones, including unique/sparse).
    // Safe to call on every startup — Mongoose skips indexes that already exist.
    await mongoose.connection.syncIndexes();
    console.log('[DB] Indexes synchronised');

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected, attempting to reconnect...');
    });

    mongoose.connection.on('error', (err) => {
      console.error('[DB] MongoDB error:', err);
    });
  } catch (error) {
    console.error('[DB] MongoDB connection failed:', error);
    process.exit(1);
  }
}
