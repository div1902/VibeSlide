import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: process.env.VIBESLIDE_EXTENSION
    ? {
        alias: { "./lib/scanEditor": "/src/lib/scanEditor.extension.ts" },
      }
    : undefined,
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
