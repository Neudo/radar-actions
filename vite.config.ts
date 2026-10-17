import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: "frontend",
  base: "/dashboard-app/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./frontend", import.meta.url)),
      cn: fileURLToPath(new URL("./frontend/lib/utils.ts", import.meta.url)),
    },
  },
  build: {
    outDir: "../dist/frontend",
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
