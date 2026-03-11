import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  use: {
    baseURL: "http://localhost:3456",
    video: "on",
    viewport: { width: 1280, height: 720 },
  },
});
