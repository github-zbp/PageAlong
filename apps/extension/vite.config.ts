import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

if (typeof globalThis.crypto?.getRandomValues !== "function") {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto
  });
}

function manifestPlugin() {
  return {
    name: "manifest-emitter",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: readFileSync(resolve(process.cwd(), "manifest.json"), "utf8")
      });
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), manifestPlugin()],
  publicDir: "public",
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: {
        sidepanel: "sidepanel.html",
        popup: "popup.html",
        background: "src/background.ts",
        contentScript: "src/contentScript.ts"
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"]
  }
});
