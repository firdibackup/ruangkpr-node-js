import { defineConfig, devices } from '@playwright/test'

// Its own port, so a dev server you keep running on 5173 (real data) is never used or blocked by the tests.
const PORT = Number(process.env.E2E_PORT ?? 5174)

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  // E2E runs the localStorage demo; never reuse a dev server that may be on real data.
  webServer: { command: `npm run dev -- --port ${PORT} --strictPort`, url: `http://localhost:${PORT}`, reuseExistingServer: false, timeout: 60_000, env: { VITE_DATA_SOURCE: 'mock', VITE_GEOAPIFY_KEY: 'e2e' } }, // Geoapify calls are stubbed per test
})
