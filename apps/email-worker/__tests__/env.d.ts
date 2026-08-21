import type { Env as WorkerEnv } from "../src/env";

// `cloudflare:test`'s `env` export is typed via the global `Cloudflare.Env`
// namespace as of @cloudflare/vitest-pool-workers 0.22 (this replaced the
// old `ProvidedEnv` module-augmentation interface that vitest-pool-workers
// 0.12 shipped empty by default) — merge it with the worker's real `Env` so
// `env.HYPERDRIVE` (used by `testPrisma.ts` and every other DB-backed test
// in this package) typechecks.
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {}
  }
}

export {};
