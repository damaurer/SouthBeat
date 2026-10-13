import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Smoke tests against the built server (run `npm run build` first). Each run gets an empty data file.
const PORT = 4310;
const data = join(mkdtempSync(join(tmpdir(), 'southbeat-e2e-')), 'southbeat.json');

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1000, height: 900 },
    // A browser that is already installed, e.g. in a container: PLAYWRIGHT_CHROMIUM=/path/to/chrome
    launchOptions: process.env['PLAYWRIGHT_CHROMIUM'] ? { executablePath: process.env['PLAYWRIGHT_CHROMIUM'], args: ['--no-sandbox'] } : {},
  },
  webServer: {
    command: 'node dist/southbeat/server/server.mjs',
    url: `http://localhost:${PORT}/api/stats`,
    env: { PORT: String(PORT), SOUTHBEAT_DATA_FILE: data },
    reuseExistingServer: false,
  },
});
