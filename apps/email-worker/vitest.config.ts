import "dotenv/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

// Prisma's workerd-targeted generated client (packages/db's `workerd`
// generator, used by `@huella/db/workerd`, `engineType = "client"`) loads
// its query compiler via `import("./query_compiler_bg.wasm?module")` — the
// `?module` resource-query
// convention wrangler's own esbuild bundler natively understands for real
// deploys (see wrangler's DEFAULT_MODULE_RULES: `{ type: "CompiledWasm",
// globs: ["**/*.wasm", "**/*.wasm?module"] }`). workerd itself forbids
// dynamic Wasm compilation at runtime ("Wasm code generation disallowed by
// embedder"), so a wasm module can only be loaded as a natively-precompiled
// binding, never as inline JS that calls `new WebAssembly.Module(bytes)`.
// @cloudflare/vitest-pool-workers *does* have exactly that native-binding
// path (via Miniflare's `modulesRules`, see below) — but its fast-path check
// for using it explicitly requires a query-free specifier
// (`!specifier.includes("?")`), which `?module` fails, so it falls through to
// Vite's normal transform instead, where it just fails to parse as JS. This
// plugin strips the `?module` suffix at resolution time (before Vite's
// import-analysis ever sees it) so the specifier that reaches vitest-pool-
// workers' RPC fetch is the plain, query-free `.wasm` path, letting the
// native `modulesRules`-driven CompiledWasm loading path apply as intended.
//
// NOTE: this plugin + `modulesRules` (below) get the specifier past that
// specific gate. Under @cloudflare/vitest-pool-workers 0.12.21 (vitest 3),
// that wasn't enough on its own: Miniflare's fallback-service still
// returned "No such module" for the `?mf_vitest_force=CompiledWasm`-suffixed
// specifier once workerd actually requested it, a long-standing upstream bug
// in module-fallback-service's handling of externalized modules reached only
// via a test file's own import graph (not the worker's `main` entrypoint) —
// see cloudflare/workers-sdk#5367, #5539, #5685, #8280. Upgrading to
// @cloudflare/vitest-pool-workers ^0.22.0 (vitest 4) fixed that deeper bug —
// confirmed empirically, see the "vitest-pool-workers upgrade investigation"
// section of `.superpowers/sdd/2026-08-20-email-worker/task-4-report.md` —
// so this plugin is now sufficient on its own for the wasm module to load.
function wasmModuleQueryPlugin(): Plugin {
  const suffix = "?module";
  return {
    name: "prisma-workerd-wasm-module-query",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!source.endsWith(suffix) || !source.slice(0, -suffix.length).endsWith(".wasm")) return null;
      const resolved = await this.resolve(source.slice(0, -suffix.length), importer, { skipSelf: true });
      return resolved?.id ?? null;
    },
  };
}

// Local Postgres connection string used for tests. Defaults to the
// docker-compose credentials (correct for anyone using the repo's documented
// Docker setup); override via `TEST_DATABASE_URL` in a gitignored `.env`
// (see `.env.example`) for a native/non-Docker local Postgres instead.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://huella:huella@localhost:5432/huella?schema=public";

// wrangler eagerly validates, while parsing wrangler.jsonc, that every
// `hyperdrive` binding has a local connection string (env var or
// `localConnectionString`) — before this file's own `miniflare.hyperdrives`
// override below ever gets applied. Setting the env var here keeps
// wrangler.jsonc a deploy-only placeholder; local dev/tests are wired to
// TEST_DATABASE_URL instead.
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??= TEST_DATABASE_URL;

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        compatibilityFlags: ["nodejs_compat"],
        hyperdrives: {
          HYPERDRIVE: TEST_DATABASE_URL,
        },
        // Paired with `wasmModuleQueryPlugin` above: tells Miniflare to
        // natively precompile `.wasm` files as CompiledWasm module
        // bindings (required — workerd disallows compiling Wasm at
        // runtime from inline JS).
        modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
      },
    }),
    wasmModuleQueryPlugin(),
  ],
});
