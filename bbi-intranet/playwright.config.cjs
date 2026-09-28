const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser', fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:3000', viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader'] } : {}
  },
  webServer: { command: 'node scripts/serve-preview.cjs', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI },
  reporter: [['list']]
});
