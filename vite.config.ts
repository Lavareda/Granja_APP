import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Copy static assets so they're available from the SW cache
      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "apple-touch-icon-180x180.png",
        "pwa-64x64.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "maskable-icon-512x512.png",
      ],
      manifest: {
        name: "GranjaApp",
        short_name: "GranjaApp",
        description: "Gestão avícola inteligente — Sítio do Bem",
        theme_color: "#2f6f4f",
        background_color: "#f6f7f2",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "pt-BR",
        categories: ["productivity", "business"],
        icons: [
          {
            src: "pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Pre-cache all static build output
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            // Never cache Supabase API or auth — always fetch fresh
            urlPattern: ({ url }) =>
              url.hostname.endsWith("supabase.co") ||
              url.hostname.endsWith("supabase.io"),
            handler: "NetworkOnly",
          },
        ],
        // Raise the size limit — the main JS bundle is ~580 kB
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      // Keep SW inactive in dev — avoids auth callback interception
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
