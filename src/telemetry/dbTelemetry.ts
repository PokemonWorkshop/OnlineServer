import mongoose from 'mongoose';
import { telemetry } from './store';

/**
 * Internal collections to exclude from telemetry.
 * Prevents recursion and noise in DB stats.
 */
const EXCLUDED_COLLECTIONS = new Set(['telemetrysnapshots']);

export function installDbTelemetry(): void {
  // List of mongoose query operations to track
  const ops = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndDelete',
    'findByIdAndUpdate',
    'findByIdAndDelete',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'countDocuments',
  ] as const;

  mongoose.plugin((schema: mongoose.Schema) => {
    ops.forEach((op) => {
      // Pre-hook: store start time
      schema.pre(op as any, function (this: mongoose.Query<unknown, unknown>) {
        (this as any)._telemetryStart = Date.now();
      });

      // Post-hook: successful completion
      schema.post(op as any, function (this: mongoose.Query<unknown, unknown>) {
        const collection = (this as any).mongooseCollection?.name ?? 'unknown';
        if (EXCLUDED_COLLECTIONS.has(collection)) return;

        const start = (this as any)._telemetryStart as number | undefined;
        const ms = start ? Date.now() - start : 0;
        telemetry.recordDbQuery(collection, op, ms, false); // false = no error
      });

      // Post-hook: error handling
      schema.post(
        op as any,
        function (
          this: mongoose.Query<unknown, unknown>,
          err: Error,
          _doc: unknown,
          next: (err?: Error) => void,
        ) {
          const collection =
            (this as any).mongooseCollection?.name ?? 'unknown';
          if (EXCLUDED_COLLECTIONS.has(collection)) {
            next(err);
            return;
          }

          const start = (this as any)._telemetryStart as number | undefined;
          const ms = start ? Date.now() - start : 0;
          telemetry.recordDbQuery(collection, op, ms, true); // true = error
          next(err);
        },
      );
    });
  });

  console.log('[Telemetry] DB plugin installed');
}
