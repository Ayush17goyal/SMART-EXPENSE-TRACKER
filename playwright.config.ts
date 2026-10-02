import { defineConfig } from '@playwright/test';
const port=Number(process.env.PLAYWRIGHT_PORT??5173);
export default defineConfig({ testDir: './tests/e2e', use: { baseURL: `http://127.0.0.1:${port}` }, webServer: { command: `npm run dev -- --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false }, reporter: 'list' });
