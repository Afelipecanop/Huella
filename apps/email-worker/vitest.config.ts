import "dotenv/config";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

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

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          compatibilityFlags: ["nodejs_compat"],
          hyperdrives: {
            HYPERDRIVE: TEST_DATABASE_URL,
          },
        },
      },
    },
  },
});
