import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    // dist/ (build output) también matchea **/*.test.ts y termina corriendo
    // los mismos tests dos veces si hay un build local sin limpiar.
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Todos los archivos de test comparten un mismo Postgres real (sin
    // aislamiento por archivo) y cada uno hace beforeEach truncando tablas
    // enteras (users, refresh_tokens, etc.) — en paralelo eso genera una
    // race real entre archivos (ver el mismo fix ya aplicado en
    // apps/email-worker/vitest.config.ts, commit 2f43d4e).
    fileParallelism: false,
  },
});
