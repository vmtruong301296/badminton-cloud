import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        // target: "http://localhost:8000",
        // Máy chủ OVH (từ 15/10/2026) — chạy dev là đọc/ghi DỮ LIỆU THẬT
        target: "https://badminton-bill.duckdns.org",
        changeOrigin: true,
      },
    },
  },
});
