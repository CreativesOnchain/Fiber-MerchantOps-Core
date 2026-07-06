import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The admin UI is a static SPA that talks to the API server over CORS (the API
// enables permissive CORS in dev). API base + default merchant are injected at
// build/dev time via VITE_* env vars; sensible localhost defaults are baked into
// src/config.ts so a bare `pnpm dev:admin` works with a default API server.
const port = Number(process.env.ADMIN_UI_PORT ?? "5173");

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number.isFinite(port) && port > 0 ? port : 5173,
    host: true,
  },
  preview: {
    port: Number.isFinite(port) && port > 0 ? port : 5173,
  },
});
