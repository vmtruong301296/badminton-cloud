import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { demoApi } from "./demo/api.mjs";

// A separate local server: never installs the Cloudflare/production API proxy.
export default defineConfig({
  plugins: [react(), demoApi()],
  define: { "import.meta.env.VITE_API_URL": JSON.stringify("/api") },
  server: { host: "0.0.0.0", port: 3001, strictPort: true },
});
