import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      includeAssets: ["favicon.svg", "pwa-192x192.png", "pwa-512x512.png"],
      workbox: {
        globPatterns: ["**/*.{html,js,css,svg,png,woff2,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    allowedHosts: ["alturagrafica.mavdev.cloud"],
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: false },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth"],
          mui: [
            "@emotion/react",
            "@emotion/styled",
            "@mui/icons-material",
            "@mui/material",
          ],
          viewer: ["openseadragon"],
          vendor: ["@tanstack/react-query", "react", "react-dom"],
        },
      },
    },
  },
});
