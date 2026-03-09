/**
 * Global test setup
 * - Sets required environment variables before any module imports ENV
 * - Provides shared mock factories
 */

// ── Environment variables ─────────────────────────────────────────────────────
process.env.API_KEY    = 'test-api-key';
process.env.ADMIN_KEY  = 'test-admin-key';
process.env.NODE_ENV   = 'test';
process.env.PORT       = '0';        // OS-assigned port during tests
process.env.DB_HOST    = 'localhost';
process.env.DB_PORT    = '27017';
process.env.DB_NAME    = 'psdk_test';
process.env.GTS_EXPIRY_DAYS    = '30';
process.env.GTS_SPECIES_BLACKLIST = '150,151'; // Mewtwo, Mew blacklisted
