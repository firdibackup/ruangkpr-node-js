import { defineConfig, devices } from '@playwright/test'

const environments = [
  { mode: 'production', port: 5185 },
  { mode: 'staging', port: 5186 },
]

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
  projects: environments.map(({ mode, port }) => ({
    name: mode,
    testMatch: mode === 'staging' ? ['environments/*.spec.js', 'e2e/demo.spec.js'] : ['environments/*.spec.js'],
    use: { baseURL: `http://localhost:${port}` },
  })),
  webServer: environments.map(({ mode, port }) => ({
    command: `npm run build:${mode} -- --outDir dist/check-${mode} && npm run preview -- --outDir dist/check-${mode} --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_DATA_SOURCE: 'supabase', VITE_SUPABASE_URL: 'https://backend.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', VITE_GEOAPIFY_KEY: '' },
  })),
})
