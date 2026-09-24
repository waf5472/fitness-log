import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `vite dev` serves the SPA only. The recipe index lives in D1 behind the
// Worker, so /api/* is proxied to `wrangler dev` on 8787 (npm run dev:api).
// With no Worker running the deck shows an "API offline" state; Cookbook and
// Spicerack still work from localStorage.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  server: {
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
});
