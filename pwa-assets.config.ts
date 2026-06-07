import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // Ensure the maskable icon keeps the full green background visible
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0,
    },
  },
  images: ["public/favicon.svg"],
});
