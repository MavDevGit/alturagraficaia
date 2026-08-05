import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -w apps/web -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_AUTH_DRIVER: "local",
      VITE_USE_AUTH_EMULATOR: "false",
      VITE_FIREBASE_API_KEY: "demo-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "altura-grafica-ia.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "altura-grafica-ia",
      VITE_FIREBASE_APP_ID: "demo-app-id",
    },
  },
  projects: [
    ...[1, 1.25, 1.5, 2].map((deviceScaleFactor) => ({
      name: `chrome-dpr-${deviceScaleFactor}`,
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome" as const,
        deviceScaleFactor,
      },
    })),
    ...[1, 1.25, 1.5, 2].map((deviceScaleFactor) => ({
      name: `edge-dpr-${deviceScaleFactor}`,
      use: {
        ...devices["Desktop Edge"],
        channel: "msedge" as const,
        deviceScaleFactor,
      },
    })),
    {
      name: "android-chrome",
      use: { ...devices["Pixel 7"], channel: "chrome" as const },
    },
  ],
});
