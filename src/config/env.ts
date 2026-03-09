import dotenv from 'dotenv';
dotenv.config();

/**
 * Throws if a required environment variable is missing.
 *
 * @param key - The name of the environment variable.
 * @returns The value of the variable.
 * @throws {Error} If the variable is not set.
 */
function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

/**
 * Application configuration derived from environment variables.
 *
 * @remarks
 * All values are read once at startup. A missing required variable
 * will throw immediately rather than failing silently at runtime.
 *
 * @example
 * ```ts
 * import { ENV } from './config/env';
 * console.log(ENV.PORT); // 3000
 * ```
 */
export const ENV = {
  /** HTTP server port. Defaults to `3000`. */
  PORT: parseInt(process.env.PORT || '3000'),

  /** Runtime environment (`development` | `production` | `test`). */
  NODE_ENV: process.env.NODE_ENV || 'development',

  /**
   * MongoDB connection URI.
   * If DB_NAME / DB_USER / DB_PSWD / DB_HOST / DB_PORT are set (old-style config),
   * the URI is assembled automatically. MONGODB_URI takes precedence if set.
   */
  MONGODB_URI: (() => {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '27017';
    const name = process.env.DB_NAME || 'psdk_online';
    const user = process.env.DB_USER;
    const pswd = process.env.DB_PSWD;
    if (user && pswd)
      return `mongodb://${user}:${pswd}@${host}:${port}/${name}?authSource=${name}`;
    return `mongodb://${host}:${port}/${name}`;
  })(),

  /**
   * Shared API key required on every HTTP request (`x-api-key` header)
   * and on every WebSocket connection (`?apiKey=` query param).
   * @required
   */
  API_KEY: required('API_KEY'),

  /**
   * Admin API key for sensitive routes: all `/telemetry/*` data endpoints
   * and all `/api/v1/mystery-gift/admin/*` routes.
   * Pass via the `x-admin-key` header. Keep strictly server-side.
   * @required
   */
  ADMIN_KEY: required('ADMIN_KEY'),

  /**
   * Comma-separated list of species IDs that cannot be deposited or
   * requested on the GTS (e.g. legendaries, event-locked species).
   * @example `"006,150,151"`
   */
  GTS_SPECIES_BLACKLIST: (process.env.GTS_SPECIES_BLACKLIST || '')
    .split(',')
    .filter(Boolean),

  /**
   * Number of days before a GTS deposit automatically expires.
   * MongoDB TTL handles the actual deletion. Defaults to `30`.
   */
  GTS_EXPIRY_DAYS: parseInt(process.env.GTS_EXPIRY_DAYS || '30'),

} as const;
