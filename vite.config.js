import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `vite dev` serves the SPA but has no Worker behind it, so /api/* would 404 and
// the LLM parse box — the whole point of the app — would fail. Proxy /api to a
// `wrangler dev` on 8787 (npm run dev:api) to get HMR and a real API at once.
// With no Worker running the proxy just refuses, and the app falls back to
// local/visitor mode exactly as it does offline.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
