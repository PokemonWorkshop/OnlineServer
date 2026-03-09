import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      API_KEY:                'test-api-key',
      ADMIN_KEY:              'test-admin-key',
      NODE_ENV:               'test',
      PORT:                   '0',
      DB_HOST:                'localhost',
      DB_PORT:                '27017',
      DB_NAME:                'psdk_test',
      GTS_EXPIRY_DAYS:        '30',
      GTS_SPECIES_BLACKLIST:  '150,151',
      DAYS_PLAYER_INACTIVE:   '30',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/telemetry/dashboard.html', 'src/telemetry/api-docs.html'],
    },
    setupFiles: ['./tests/setup.ts'],
  },
});
