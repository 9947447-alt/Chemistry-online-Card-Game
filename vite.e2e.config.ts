import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { readBuildCommit, releaseHtmlPlugin } from "./vite.config";

export default defineConfig({
  root: resolve(import.meta.dirname, "e2e"),
  base: "./",
  plugins: [releaseHtmlPlugin(), react()],
  define: {
    __APP_COMMIT__: JSON.stringify(readBuildCommit()),
    __PHASE11_E2E_FIXTURE__: JSON.stringify(true),
  },
  build: {
    outDir: resolve(import.meta.dirname, "dist-e2e"),
    emptyOutDir: true,
    sourcemap: false,
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
});
