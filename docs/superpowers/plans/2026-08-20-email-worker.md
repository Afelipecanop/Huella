# apps/email-worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/email-worker` — a Cloudflare Email Worker that receives correos forwarded to `<user_id>@ingest.huella.app`, parses them with `postal-mime` + `@huella/bank-templates`, and writes `Transaction`/`IngestionEvent` rows directly to Postgres via Prisma + Cloudflare Hyperdrive — plus the `packages/db` extraction and `Account.bank_template_id` schema change the worker depends on.

**Architecture:** Prisma's schema/migrations/seed move out of `apps/api` into a new shared package, `packages/db`, so both `apps/api` and `apps/email-worker` generate their Prisma Client from one source of truth. The worker itself is four small, independently-testable functions (`resolveUser`, `parseEmail`, `processEmail`, `persistIngestion`) composed by a thin `email()` handler. Because Cloudflare Workers can't spawn Prisma's native query-engine binary, the worker's Prisma Client always runs through `@prisma/adapter-pg` (driver adapters), backed by the connection string Hyperdrive provides — in local dev/tests, Miniflare emulates that binding by pointing straight at the same `docker-compose.yml` Postgres.

**Tech Stack:** TypeScript, Prisma 6 (driver adapters preview feature), `@prisma/adapter-pg` + `pg`, `postal-mime`, Cloudflare Workers (`wrangler`, `@cloudflare/workers-types`), Vitest + `@cloudflare/vitest-pool-workers` (Miniflare) for the worker's tests, plain Vitest for `packages/db`'s consumers (unchanged).

**Spec:** `docs/superpowers/specs/2026-08-20-email-worker-design.md`

## Global Constraints

- New workspace packages: `@huella/db` (`packages/db`) and `@huella/email-worker` (`apps/email-worker`), both picked up automatically by the existing `packages: ["apps/*", "packages/*"]` pattern in `pnpm-workspace.yaml`.
- `packages/db`'s `tsconfig.json`/`tsconfig.typecheck.json` mirror `apps/api`'s exactly (`NodeNext` module/resolution, explicit `.js` extensions on relative imports) — it's a plain Node package like `apps/api` and `packages/bank-templates`.
- `apps/email-worker` is the one package in this monorepo that runs inside `wrangler`'s bundler, not plain `tsc`+Node — its `tsconfig.json` uses `"module": "ES2022"` / `"moduleResolution": "Bundler"`, and its relative imports have **no** `.js` extension (unlike every other package in the repo). This is a deliberate, scoped deviation — don't "fix" it to match the rest of the monorepo.
- Cloudflare Workers cannot run Prisma's default (binary) query engine. Every Prisma Client the worker constructs — in `src/index.ts` and in every test file — goes through `@prisma/adapter-pg`, never `new PrismaClient()` bare.
- `Transaction.amount` is signed (negative = expense, positive = income, per `amountSchema` in `@huella/shared-types`). The worker always stores `-extracted.amount` — every template today is a purchase notification. Do not add a debit/credit heuristic beyond that; it's explicitly out of scope (see spec, "No-goals").
- Transactions the worker creates are always `source: "email"`, `status: "pending"` — never `"confirmed"`.
- `IngestionEvent.parsed_ok` is `true` if and only if a `Transaction` was created. Every other outcome (no template match, failed extraction, zero or multiple linked accounts) persists an `IngestionEvent` with `parsed_ok: false` and `transaction_id: null`, never throws, and never skips persisting.
- An unresolvable recipient (`to` isn't a well-formed `cuid` under `@ingest.huella.app`, or no `User` has that id) is the one case that persists nothing at all — there's no `user_id` to attach a record to.
- Local dev/test Postgres connection string (already used by `apps/api/.env.example` and `docker-compose.yml`): `postgresql://huella:huella@localhost:5432/huella?schema=public`.

---

## Task 1: Extract `packages/db`

**Files:**
- Move: `apps/api/prisma/schema.prisma` → `packages/db/prisma/schema.prisma`
- Move: `apps/api/prisma/seed.ts` → `packages/db/prisma/seed.ts`
- Move: `apps/api/prisma/migrations/` → `packages/db/prisma/migrations/`
- Move: `apps/api/prisma.config.ts` → `packages/db/prisma.config.ts`
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/tsconfig.typecheck.json`
- Create: `packages/db/src/index.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/tsconfig.typecheck.json`
- Modify: `apps/api/src/plugins/prisma.ts`
- Modify: `apps/api/src/types/fastify.d.ts`
- Modify: `apps/api/src/serializers.ts`

**Interfaces:**
- Produces: `@huella/db`, exporting everything `@prisma/client` exports (the `PrismaClient` class plus every generated model/enum type). Consumed by `apps/api` (this task) and `apps/email-worker` (Tasks 3–8).

- [ ] **Step 1: Move the Prisma files with `git mv` (preserves history)**

```bash
mkdir -p packages/db/prisma packages/db/src
git mv apps/api/prisma/schema.prisma packages/db/prisma/schema.prisma
git mv apps/api/prisma/seed.ts packages/db/prisma/seed.ts
git mv apps/api/prisma/migrations packages/db/prisma/migrations
git mv apps/api/prisma.config.ts packages/db/prisma.config.ts
```

- [ ] **Step 2: Write `packages/db/package.json`**

```json
{
  "name": "@huella/db",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "typecheck": "tsc -p tsconfig.typecheck.json --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "db:seed": "prisma db seed"
  },
  "dependencies": {
    "@huella/bank-templates": "workspace:*",
    "@prisma/client": "^6.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "dotenv": "^16.4.0",
    "prisma": "^6.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 3: Write `packages/db/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write `packages/db/tsconfig.typecheck.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "."
  },
  "include": ["src", "prisma"]
}
```

- [ ] **Step 5: Write `packages/db/src/index.ts`**

```ts
export * from "@prisma/client";
```

- [ ] **Step 6: Update `apps/api/tsconfig.typecheck.json` — drop the now-nonexistent `prisma` dir**

Change:

```json
  "include": ["src", "prisma"]
```

to:

```json
  "include": ["src"]
```

- [ ] **Step 7: Update `apps/api/package.json` — drop Prisma deps/scripts, add `@huella/db`**

Replace the whole file with:

```json
{
  "name": "@huella/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.typecheck.json --noEmit"
  },
  "dependencies": {
    "@huella/bank-templates": "workspace:*",
    "@huella/db": "workspace:*",
    "@huella/shared-types": "workspace:*",
    "fastify": "^5.0.0",
    "fastify-plugin": "^5.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

(`dotenv` and `prisma`/`@prisma/client` are gone — `dotenv` was only ever used by `prisma.config.ts`, which just moved to `packages/db`; `apps/api/src` never imports it.)

- [ ] **Step 8: Update `apps/api/src/plugins/prisma.ts`**

Change the import line:

```ts
import { PrismaClient } from "@prisma/client";
```

to:

```ts
import { PrismaClient } from "@huella/db";
```

- [ ] **Step 9: Update `apps/api/src/types/fastify.d.ts`**

Change:

```ts
import type { PrismaClient } from "@prisma/client";
```

to:

```ts
import type { PrismaClient } from "@huella/db";
```

- [ ] **Step 10: Update `apps/api/src/serializers.ts`**

Change the top import block:

```ts
import type {
  User as PrismaUser,
  Account as PrismaAccount,
  Category as PrismaCategory,
  Transaction as PrismaTransaction,
  IngestionEvent as PrismaIngestionEvent,
  BankTemplate as PrismaBankTemplate,
} from "@prisma/client";
```

to:

```ts
import type {
  User as PrismaUser,
  Account as PrismaAccount,
  Category as PrismaCategory,
  Transaction as PrismaTransaction,
  IngestionEvent as PrismaIngestionEvent,
  BankTemplate as PrismaBankTemplate,
} from "@huella/db";
```

- [ ] **Step 11: Install and generate**

```bash
corepack pnpm install
corepack pnpm --filter @huella/db run prisma:generate
```

- [ ] **Step 12: Typecheck both touched packages**

Run: `corepack pnpm --filter @huella/db run typecheck`
Expected: no errors.

Run: `corepack pnpm --filter @huella/api run typecheck`
Expected: no errors.

- [ ] **Step 13: Verify the API still runs against the moved schema**

Make sure Postgres is up: `corepack pnpm db:up`

Run: `corepack pnpm --filter @huella/api dev` (leave running)

Run: `curl http://127.0.0.1:3000/health`
Expected: `200 OK` (or whatever the existing health payload is — same as before this task).

Run: `curl http://127.0.0.1:3000/accounts -H "x-user-id: u10cj1c94sj9o76bqbd4wam0"`
Expected: a JSON array (empty or with existing accounts) — proves `fastify.prisma` still works end-to-end through `@huella/db`.

Stop the dev server (Ctrl+C).

- [ ] **Step 14: Commit**

```bash
git add packages/db apps/api pnpm-lock.yaml
git commit -m "refactor(db): extract packages/db, share Prisma schema between apps/api and apps/email-worker"
```

---

## Task 2: `Account.bank_template_id`

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_add_account_bank_template_id/migration.sql` (generated by Prisma, not hand-written)
- Modify: `packages/shared-types/src/account.ts`
- Modify: `apps/api/src/serializers.ts`
- Modify: `apps/api/src/routes/accounts.ts`
- Modify: `apps/api/src/routes/ingestion-events.ts`

**Interfaces:**
- Produces: `Account.bank_template_id: string | null` in the API contract (`@huella/shared-types`) and in the DB (`accounts.bank_template_id`, FK to `bank_templates.id`, `onDelete: SetNull`). Consumed by `apps/email-worker`'s `processEmail` (Task 7) to resolve which account a parsed transaction belongs to.

- [ ] **Step 1: Add the field and relation to `packages/db/prisma/schema.prisma`**

In the `Account` model, change:

```prisma
model Account {
  id        String      @id @default(cuid(2))
  userId    String      @map("user_id")
  name      String
  type      AccountType
  currency  String      @db.Char(3)
  createdAt DateTime    @default(now()) @map("created_at")
  updatedAt DateTime    @updatedAt @map("updated_at")

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]

  @@index([userId])
  @@map("accounts")
}
```

to:

```prisma
model Account {
  id             String      @id @default(cuid(2))
  userId         String      @map("user_id")
  name           String
  type           AccountType
  currency       String      @db.Char(3)
  bankTemplateId String?     @map("bank_template_id")
  createdAt      DateTime    @default(now()) @map("created_at")
  updatedAt      DateTime    @updatedAt @map("updated_at")

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  bankTemplate BankTemplate? @relation(fields: [bankTemplateId], references: [id], onDelete: SetNull)
  transactions Transaction[]

  @@index([userId])
  @@index([bankTemplateId])
  @@map("accounts")
}
```

In the `BankTemplate` model, add the reverse relation:

```prisma
model BankTemplate {
  // ...unchanged fields...

  ingestionEvents IngestionEvent[]
  accounts        Account[]

  @@map("bank_templates")
}
```

- [ ] **Step 2: Generate and apply the migration**

Make sure Postgres is up: `corepack pnpm db:up`

Run: `corepack pnpm --filter @huella/db exec prisma migrate dev --name add_account_bank_template_id`
Expected: `Your database is now in sync with your schema.`

- [ ] **Step 3: Update `packages/shared-types/src/account.ts`**

Replace the whole file with:

```ts
import { z } from "zod";
import { idSchema, currencySchema, timestampSchema } from "./common.js";

export const accountTypeSchema = z.enum(["bank", "cash", "wallet"]);

export const accountSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  name: z.string().min(1),
  type: accountTypeSchema,
  currency: currencySchema,
  bank_template_id: idSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

// user_id no viaja en el payload: lo determina el backend a partir de la
// identidad autenticada (header x-user-id por ahora, JWT más adelante).
// bank_template_id es opcional en creación/actualización: por default una
// cuenta no está vinculada a ninguna plantilla de banco.
export const createAccountSchema = accountSchema
  .omit({
    id: true,
    user_id: true,
    created_at: true,
    updated_at: true,
  })
  .extend({
    bank_template_id: idSchema.nullable().optional(),
  });

export const updateAccountSchema = createAccountSchema.partial();

export type AccountType = z.infer<typeof accountTypeSchema>;
export type Account = z.infer<typeof accountSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;
export type UpdateAccount = z.infer<typeof updateAccountSchema>;
```

- [ ] **Step 4: Update `serializeAccount` in `apps/api/src/serializers.ts`**

Change:

```ts
export function serializeAccount(a: PrismaAccount) {
  return accountSchema.parse({
    id: a.id,
    user_id: a.userId,
    name: a.name,
    type: a.type,
    currency: a.currency,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
  });
}
```

to:

```ts
export function serializeAccount(a: PrismaAccount) {
  return accountSchema.parse({
    id: a.id,
    user_id: a.userId,
    name: a.name,
    type: a.type,
    currency: a.currency,
    bank_template_id: a.bankTemplateId,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
  });
}
```

- [ ] **Step 5: Rewrite `apps/api/src/routes/accounts.ts`**

`createAccountSchema`'s validated output uses snake_case (`bank_template_id`), but Prisma's `data` object needs the camelCase model field (`bankTemplateId`) — spreading `...data` straight into Prisma's `data` (like the create/update handlers do today for `name`/`type`/`currency`, which happen to be spelled the same both ways) would send an unrecognized `bank_template_id` key and fail at runtime. Map fields explicitly instead, and validate the linked template exists (same pattern as `assertParentOwnedByUser` in `categories.ts`):

```ts
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { createAccountSchema, updateAccountSchema } from "@huella/shared-types";
import { parseOrReject } from "../lib/validate.js";
import { serializeAccount } from "../serializers.js";

const accountRoutes: FastifyPluginAsync = async (fastify) => {
  async function assertBankTemplateExists(
    bankTemplateId: string | null | undefined,
    reply: FastifyReply,
  ): Promise<boolean> {
    if (!bankTemplateId) return true;
    const template = await fastify.prisma.bankTemplate.findUnique({ where: { id: bankTemplateId } });
    if (!template) {
      reply.code(400).send({ error: "bank_template_id no corresponde a una plantilla existente" });
      return false;
    }
    return true;
  }

  fastify.get("/", async (request) => {
    const accounts = await fastify.prisma.account.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "asc" },
    });
    return accounts.map(serializeAccount);
  });

  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const account = await fastify.prisma.account.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!account) {
      reply.code(404).send({ error: "Cuenta no encontrada" });
      return;
    }
    return serializeAccount(account);
  });

  fastify.post("/", async (request, reply) => {
    const data = parseOrReject(createAccountSchema, request.body, reply);
    if (!data) return reply;

    if (!(await assertBankTemplateExists(data.bank_template_id, reply))) return reply;

    const account = await fastify.prisma.account.create({
      data: {
        userId: request.userId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        bankTemplateId: data.bank_template_id ?? null,
      },
    });
    reply.code(201);
    return serializeAccount(account);
  });

  fastify.patch<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await fastify.prisma.account.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!existing) {
      reply.code(404).send({ error: "Cuenta no encontrada" });
      return;
    }

    const data = parseOrReject(updateAccountSchema, request.body, reply);
    if (!data) return reply;

    if (!(await assertBankTemplateExists(data.bank_template_id, reply))) return reply;

    const account = await fastify.prisma.account.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.bank_template_id !== undefined && { bankTemplateId: data.bank_template_id }),
      },
    });
    return serializeAccount(account);
  });

  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await fastify.prisma.account.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!existing) {
      reply.code(404).send({ error: "Cuenta no encontrada" });
      return;
    }

    await fastify.prisma.account.delete({ where: { id: existing.id } });
    reply.code(204);
  });
};

export default accountRoutes;
```

- [ ] **Step 6: Fix the stale comment in `apps/api/src/routes/ingestion-events.ts`**

Change:

```ts
// Solo lectura: la creación (via el webhook del email-worker) y el enlace a
// transaction_id se resuelven en la fase de apps/email-worker, no acá.
```

to:

```ts
// Solo lectura: apps/email-worker crea estos registros escribiendo directo
// contra Postgres (no vía esta API) — ver
// docs/superpowers/specs/2026-08-20-email-worker-design.md.
```

- [ ] **Step 7: Typecheck**

Run: `corepack pnpm --filter @huella/api run typecheck`
Expected: no errors.

- [ ] **Step 8: Manual verification**

Make sure Postgres is up and seeded (`corepack pnpm db:up`, then `corepack pnpm --filter @huella/db run db:seed` if not already seeded), then start the API: `corepack pnpm --filter @huella/api dev`

Get the seeded Bancolombia template's id:

```bash
curl http://127.0.0.1:3000/bank-templates -H "x-user-id: u10cj1c94sj9o76bqbd4wam0"
```

Copy its `"id"` value, then create an account linked to it:

```bash
curl -X POST http://127.0.0.1:3000/accounts \
  -H "x-user-id: u10cj1c94sj9o76bqbd4wam0" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bancolombia","type":"bank","currency":"COP","bank_template_id":"<paste the id>"}'
```

Expected: `201`, response body includes `"bank_template_id": "<the id you pasted>"`.

Run: `curl -X POST http://127.0.0.1:3000/accounts -H "x-user-id: u10cj1c94sj9o76bqbd4wam0" -H "Content-Type: application/json" -d '{"name":"Bad","type":"bank","currency":"COP","bank_template_id":"u10cj1c94sj9o76bqbd4wam1"}'`
Expected: `400`, `{"error":"bank_template_id no corresponde a una plantilla existente"}` (that id is well-formed but doesn't exist).

Stop the dev server.

- [ ] **Step 9: Commit**

```bash
git add packages/db/prisma packages/shared-types/src/account.ts apps/api/src/serializers.ts apps/api/src/routes/accounts.ts apps/api/src/routes/ingestion-events.ts
git commit -m "feat(api): Account.bank_template_id"
```

---

## Task 3: Scaffold `apps/email-worker`

**Files:**
- Create: `apps/email-worker/package.json`
- Create: `apps/email-worker/tsconfig.json`
- Create: `apps/email-worker/wrangler.jsonc`
- Create: `apps/email-worker/vitest.config.ts`
- Create: `apps/email-worker/src/env.ts`
- Create: `apps/email-worker/src/index.ts` (placeholder, replaced in Task 8)
- Create: `apps/email-worker/__tests__/smoke.test.ts`
- Delete: `apps/email-worker/.gitkeep`

**Interfaces:**
- Produces: a working `@huella/email-worker` package where `pnpm --filter @huella/email-worker run typecheck` and `test` both pass against the placeholder, running under Miniflare (not plain Node).

- [ ] **Step 1: Remove the placeholder and create directories**

```bash
rm apps/email-worker/.gitkeep
mkdir -p apps/email-worker/src apps/email-worker/__tests__
```

- [ ] **Step 2: Write `apps/email-worker/package.json`**

```json
{
  "name": "@huella/email-worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@huella/bank-templates": "workspace:*",
    "@huella/db": "workspace:*",
    "@huella/shared-types": "workspace:*",
    "@prisma/adapter-pg": "^6.0.0",
    "postal-mime": "^2.2.0"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.6.0",
    "@cloudflare/workers-types": "^4.0.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 3: Write `apps/email-worker/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "__tests__"]
}
```

- [ ] **Step 4: Write `apps/email-worker/wrangler.jsonc`**

```jsonc
{
  "name": "huella-email-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-20",
  "compatibility_flags": ["nodejs_compat"],
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      // Placeholder: no real Cloudflare Hyperdrive resource exists yet
      // (deployment is Fase 7, out of scope here). Local dev/tests never
      // reach this id — vitest.config.ts's `hyperdrives` override points
      // straight at the docker-compose Postgres instead.
      "id": "placeholder-hyperdrive-id"
    }
  ]
}
```

- [ ] **Step 5: Write `apps/email-worker/vitest.config.ts`**

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          compatibilityFlags: ["nodejs_compat"],
          hyperdrives: {
            HYPERDRIVE: "postgresql://huella:huella@localhost:5432/huella?schema=public",
          },
        },
      },
    },
  },
});
```

- [ ] **Step 6: Write `apps/email-worker/src/env.ts`**

```ts
export interface Env {
  HYPERDRIVE: { connectionString: string };
}
```

- [ ] **Step 7: Write the placeholder `apps/email-worker/src/index.ts`**

```ts
export default {
  async email() {},
};
```

- [ ] **Step 8: Write `apps/email-worker/__tests__/smoke.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import worker from "../src/index";

describe("email-worker scaffold", () => {
  it("exports an email handler", () => {
    expect(typeof worker.email).toBe("function");
  });
});
```

- [ ] **Step 9: Install**

```bash
corepack pnpm install
```

- [ ] **Step 10: Verify the scaffold typechecks and tests**

Run: `corepack pnpm --filter @huella/email-worker run typecheck`
Expected: no errors.

Run: `corepack pnpm --filter @huella/email-worker test`
Expected: PASS, 1 test. (Docker/Postgres doesn't need to be running yet — this test never touches the `HYPERDRIVE` binding.)

- [ ] **Step 11: Commit**

```bash
git add apps/email-worker pnpm-lock.yaml
git commit -m "feat(email-worker): scaffold package"
```

---

## Task 4: `resolveUser`

**Files:**
- Create: `apps/email-worker/src/resolveUser.ts`
- Create: `apps/email-worker/__tests__/testPrisma.ts`
- Create: `apps/email-worker/__tests__/resolveUser.test.ts`

**Interfaces:**
- Produces: `resolveUser(to: string, prisma: PrismaClient): Promise<string | null>`. Consumed by `src/index.ts` (Task 8).
- Produces: `createTestPrisma(): PrismaClient` (test-only helper, constructs a real driver-adapter Prisma Client against the local dev Postgres — every DB-backed test in this package uses it). Consumed by Tasks 6, 7, 8's tests.

- [ ] **Step 1: Write the test-DB helper `apps/email-worker/__tests__/testPrisma.ts`**

Prisma Client inside a Workers runtime can only use the driver-adapter engine (no native binary) — so even test setup/teardown code needs the adapter, not a bare `new PrismaClient()`:

```ts
import { PrismaClient } from "@huella/db";
import { PrismaPg } from "@prisma/adapter-pg";

const CONNECTION_STRING = "postgresql://huella:huella@localhost:5432/huella?schema=public";

export function createTestPrisma() {
  const adapter = new PrismaPg({ connectionString: CONNECTION_STRING });
  return new PrismaClient({ adapter });
}
```

- [ ] **Step 2: Write the failing test**

`apps/email-worker/__tests__/resolveUser.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestPrisma } from "./testPrisma";
import { resolveUser } from "../src/resolveUser";

const prisma = createTestPrisma();
let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `resolve-user-${Date.now()}@example.com`,
      name: "Test User",
      defaultCurrency: "COP",
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("resolveUser", () => {
  it("resolves the user_id when the recipient matches an existing user", async () => {
    const result = await resolveUser(`${userId}@ingest.huella.app`, prisma);
    expect(result).toBe(userId);
  });

  it("returns null when the recipient's local part isn't a valid cuid", async () => {
    const result = await resolveUser("not-a-cuid@ingest.huella.app", prisma);
    expect(result).toBeNull();
  });

  it("returns null when the recipient domain doesn't match", async () => {
    const result = await resolveUser(`${userId}@other-domain.com`, prisma);
    expect(result).toBeNull();
  });

  it("returns null when the cuid is well-formed but no user exists with that id", async () => {
    const result = await resolveUser("u10cj1c94sj9o76bqbd4wam1@ingest.huella.app", prisma);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Make sure Postgres is up: `corepack pnpm db:up`

Run: `corepack pnpm --filter @huella/email-worker test __tests__/resolveUser.test.ts`
Expected: FAIL — `Failed to resolve import "../src/resolveUser"`.

- [ ] **Step 4: Write `apps/email-worker/src/resolveUser.ts`**

```ts
import { idSchema } from "@huella/shared-types";
import type { PrismaClient } from "@huella/db";

const RECIPIENT_PATTERN = /^([^@]+)@ingest\.huella\.app$/i;

export async function resolveUser(to: string, prisma: PrismaClient): Promise<string | null> {
  const match = RECIPIENT_PATTERN.exec(to);
  if (!match) return null;

  const candidateId = match[1];
  if (!idSchema.safeParse(candidateId).success) return null;

  const user = await prisma.user.findUnique({ where: { id: candidateId } });
  return user ? user.id : null;
}
```

- [ ] **Step 5: Run the tests again**

Run: `corepack pnpm --filter @huella/email-worker test __tests__/resolveUser.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/email-worker/src/resolveUser.ts apps/email-worker/__tests__/testPrisma.ts apps/email-worker/__tests__/resolveUser.test.ts
git commit -m "feat(email-worker): resolveUser"
```

---

## Task 5: `parseEmail`

**Files:**
- Create: `apps/email-worker/src/parseEmail.ts`
- Create: `apps/email-worker/__tests__/fixtures/bancolombiaCompraRaw.ts`
- Create: `apps/email-worker/__tests__/parseEmail.test.ts`

**Interfaces:**
- Produces: `type ParsedEmail = { from: string; text: string }`; `parseEmail(raw: ReadableStream<Uint8Array>): Promise<ParsedEmail>`. Consumed by `src/index.ts` (Task 8).
- Produces: `bancolombiaCompraRawEmail: string` and `rawEmailToStream(raw: string): ReadableStream<Uint8Array>` (test fixtures). Consumed by Task 8's wiring test.

- [ ] **Step 1: Write the raw-MIME fixture**

`apps/email-worker/__tests__/fixtures/bancolombiaCompraRaw.ts`:

```ts
// Correo crudo fabricado (no real), mismo contenido que
// bancolombiaCompraFixture en @huella/bank-templates pero con headers MIME
// completos, para probar el parseo end-to-end.
export const bancolombiaCompraRawEmail = [
  "From: alertasynotificaciones@bancolombia.com.co",
  "To: u10cj1c94sj9o76bqbd4wam0@ingest.huella.app",
  "Subject: Bancolombia le informa",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Bancolombia le informa que ha realizado una Compra por $85.000,00 en ALMACENES EXITO el 20/08/2026 a las 14:32 desde su producto *1234.",
  "",
].join("\r\n");

export function rawEmailToStream(raw: string): ReadableStream<Uint8Array> {
  return new Response(raw).body!;
}
```

- [ ] **Step 2: Write the failing test**

`apps/email-worker/__tests__/parseEmail.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseEmail } from "../src/parseEmail";
import { bancolombiaCompraRawEmail, rawEmailToStream } from "./fixtures/bancolombiaCompraRaw";

describe("parseEmail", () => {
  it("extracts the sender and plain-text body from raw MIME", async () => {
    const result = await parseEmail(rawEmailToStream(bancolombiaCompraRawEmail));

    expect(result.from).toBe("alertasynotificaciones@bancolombia.com.co");
    expect(result.text).toContain("Compra por $85.000,00 en ALMACENES EXITO");
  });

  it("falls back to stripped HTML when there is no plain-text part", async () => {
    const htmlOnly = [
      "From: alerts@testbank.com",
      "To: someone@ingest.huella.app",
      "Subject: Test",
      "Content-Type: text/html; charset=utf-8",
      "",
      "<p>Compra por <b>$10.000,00</b> en TIENDA</p>",
      "",
    ].join("\r\n");

    const result = await parseEmail(rawEmailToStream(htmlOnly));

    expect(result.text).toContain("Compra por");
    expect(result.text).toContain("$10.000,00");
    expect(result.text).not.toContain("<b>");
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `corepack pnpm --filter @huella/email-worker test __tests__/parseEmail.test.ts`
Expected: FAIL — `Failed to resolve import "../src/parseEmail"`.

- [ ] **Step 4: Write `apps/email-worker/src/parseEmail.ts`**

```ts
import PostalMime from "postal-mime";

export type ParsedEmail = {
  from: string;
  text: string;
};

export async function parseEmail(raw: ReadableStream<Uint8Array>): Promise<ParsedEmail> {
  const buffer = await new Response(raw).arrayBuffer();
  const parsed = await new PostalMime().parse(buffer);

  const text = parsed.text?.trim() ? parsed.text : stripHtml(parsed.html ?? "");

  return {
    from: parsed.from?.address ?? "",
    text,
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
```

- [ ] **Step 5: Run the tests again**

Run: `corepack pnpm --filter @huella/email-worker test __tests__/parseEmail.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/email-worker/src/parseEmail.ts apps/email-worker/__tests__/fixtures apps/email-worker/__tests__/parseEmail.test.ts
git commit -m "feat(email-worker): parseEmail"
```

---

## Task 6: `persistIngestion`

**Files:**
- Create: `apps/email-worker/src/persist.ts`
- Create: `apps/email-worker/__tests__/persist.test.ts`

**Interfaces:**
- Consumes: `createTestPrisma` (Task 4, test-only).
- Produces: `type PersistOutcome` and `persistIngestion(prisma: PrismaClient, outcome: PersistOutcome): Promise<void>`. Consumed by `processEmail` (Task 7).

- [ ] **Step 1: Write the failing test**

`apps/email-worker/__tests__/persist.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestPrisma } from "./testPrisma";
import { persistIngestion } from "../src/persist";

const prisma = createTestPrisma();

let userId: string;
let accountId: string;
let templateId: string;

beforeEach(async () => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  const user = await prisma.user.create({
    data: { email: `persist-${suffix}@example.com`, name: "Test User", defaultCurrency: "COP" },
  });
  userId = user.id;

  const template = await prisma.bankTemplate.create({
    data: {
      bankName: "Test Bank",
      country: "CO",
      senderPattern: `^persist-${suffix}@testbank\\.com$`,
      extractionRules: [],
    },
  });
  templateId = template.id;

  const account = await prisma.account.create({
    data: { userId, name: "Cuenta test", type: "bank", currency: "COP", bankTemplateId: templateId },
  });
  accountId = account.id;
});

afterEach(async () => {
  await prisma.user.delete({ where: { id: userId } });
  await prisma.bankTemplate.delete({ where: { id: templateId } });
});

describe("persistIngestion", () => {
  it("persists a failed outcome as an unparsed IngestionEvent", async () => {
    await persistIngestion(prisma, {
      userId,
      templateId: null,
      rawContent: "correo no reconocido",
      transaction: null,
    });

    const events = await prisma.ingestionEvent.findMany({ where: { userId } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ parsedOk: false, templateId: null, transactionId: null });
  });

  it("persists a successful outcome as a pending Transaction plus a parsed IngestionEvent", async () => {
    await persistIngestion(prisma, {
      userId,
      templateId,
      rawContent: "Compra por $85.000,00 en ALMACENES EXITO",
      transaction: {
        accountId,
        amount: -8500000,
        date: "2026-08-20T19:32:00.000Z",
        currency: "COP",
        merchant: "ALMACENES EXITO",
      },
    });

    const transactions = await prisma.transaction.findMany({ where: { userId } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      amount: -8500000,
      currency: "COP",
      merchant: "ALMACENES EXITO",
      source: "email",
      status: "pending",
      accountId,
    });

    const events = await prisma.ingestionEvent.findMany({ where: { userId } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ parsedOk: true, templateId, transactionId: transactions[0].id });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `corepack pnpm --filter @huella/email-worker test __tests__/persist.test.ts`
Expected: FAIL — `Failed to resolve import "../src/persist"`.

- [ ] **Step 3: Write `apps/email-worker/src/persist.ts`**

```ts
import type { PrismaClient } from "@huella/db";

type FailedOutcome = {
  userId: string;
  templateId: string | null;
  rawContent: string;
  transaction: null;
};

type SucceededOutcome = {
  userId: string;
  templateId: string;
  rawContent: string;
  transaction: {
    accountId: string;
    amount: number;
    date: string;
    currency: string;
    merchant?: string;
  };
};

export type PersistOutcome = FailedOutcome | SucceededOutcome;

export async function persistIngestion(prisma: PrismaClient, outcome: PersistOutcome): Promise<void> {
  if (outcome.transaction === null) {
    await prisma.ingestionEvent.create({
      data: {
        userId: outcome.userId,
        templateId: outcome.templateId,
        rawContent: outcome.rawContent,
        parsedOk: false,
      },
    });
    return;
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId: outcome.userId,
      accountId: outcome.transaction.accountId,
      amount: outcome.transaction.amount,
      currency: outcome.transaction.currency,
      merchant: outcome.transaction.merchant ?? null,
      date: new Date(outcome.transaction.date),
      source: "email",
      status: "pending",
    },
  });

  await prisma.ingestionEvent.create({
    data: {
      userId: outcome.userId,
      templateId: outcome.templateId,
      transactionId: transaction.id,
      rawContent: outcome.rawContent,
      parsedOk: true,
    },
  });
}
```

- [ ] **Step 4: Run the tests again**

Run: `corepack pnpm --filter @huella/email-worker test __tests__/persist.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/email-worker/src/persist.ts apps/email-worker/__tests__/persist.test.ts
git commit -m "feat(email-worker): persistIngestion"
```

---

## Task 7: `processEmail`

**Files:**
- Create: `apps/email-worker/src/processEmail.ts`
- Create: `apps/email-worker/__tests__/processEmail.test.ts`

**Interfaces:**
- Consumes: `matchTemplate`, `extractFields` from `@huella/bank-templates`; `persistIngestion` (Task 6).
- Produces: `processEmail(prisma: PrismaClient, params: { userId: string; from: string; text: string }): Promise<void>`. Consumed by `src/index.ts` (Task 8).

This is the orchestration the spec's decision tree describes: match a `BankTemplate` row by sender, extract fields, resolve the linked `Account`, and persist — covering 5 of the design's 6 documented outcomes (the 6th, an unresolvable recipient, is `resolveUser`'s job — Task 4 — and never reaches this function).

- [ ] **Step 1: Write the failing test**

`apps/email-worker/__tests__/processEmail.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestPrisma } from "./testPrisma";
import { processEmail } from "../src/processEmail";

const prisma = createTestPrisma();

const TEST_BANK_RULES = [
  { field: "amount" as const, pattern: "monto: ([\\d.,]+)", group: 1 },
  { field: "date" as const, pattern: "fecha: (\\d{2}/\\d{2}/\\d{4} a las \\d{2}:\\d{2})", group: 1 },
  { field: "merchant" as const, pattern: "comercio: (.+)", group: 1 },
];

function testEmailBody() {
  return "monto: 10.000,00 fecha: 05/01/2026 a las 09:00 comercio: TIENDA X";
}

let userId: string;
let templateId: string;
let senderAddress: string;

beforeEach(async () => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  senderAddress = `alerts-${suffix}@testbank.com`;

  const user = await prisma.user.create({
    data: { email: `process-${suffix}@example.com`, name: "Test User", defaultCurrency: "COP" },
  });
  userId = user.id;

  const template = await prisma.bankTemplate.create({
    data: {
      bankName: "Test Bank",
      country: "CO",
      senderPattern: `^${senderAddress.replace(".", "\\.")}$`,
      extractionRules: TEST_BANK_RULES,
    },
  });
  templateId = template.id;
});

afterEach(async () => {
  await prisma.user.delete({ where: { id: userId } });
  await prisma.bankTemplate.delete({ where: { id: templateId } });
});

describe("processEmail", () => {
  it("creates a pending Transaction and a parsed IngestionEvent on the happy path", async () => {
    const account = await prisma.account.create({
      data: { userId, name: "Cuenta test", type: "bank", currency: "COP", bankTemplateId: templateId },
    });

    await processEmail(prisma, { userId, from: senderAddress, text: testEmailBody() });

    const transactions = await prisma.transaction.findMany({ where: { userId } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      amount: -1000000,
      currency: "COP",
      merchant: "TIENDA X",
      accountId: account.id,
      source: "email",
      status: "pending",
    });

    const events = await prisma.ingestionEvent.findMany({ where: { userId } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ parsedOk: true, templateId, transactionId: transactions[0].id });
  });

  it("persists an unparsed IngestionEvent when no template matches the sender", async () => {
    await processEmail(prisma, { userId, from: "unknown@nowhere.com", text: testEmailBody() });

    const events = await prisma.ingestionEvent.findMany({ where: { userId } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ parsedOk: false, templateId: null, transactionId: null });
  });

  it("persists an unparsed IngestionEvent when the template matches but extraction fails", async () => {
    await processEmail(prisma, { userId, from: senderAddress, text: "correo sin los campos esperados" });

    const events = await prisma.ingestionEvent.findMany({ where: { userId } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ parsedOk: false, templateId, transactionId: null });
  });

  it("persists an unparsed IngestionEvent when there is no Account linked to the template", async () => {
    await processEmail(prisma, { userId, from: senderAddress, text: testEmailBody() });

    const events = await prisma.ingestionEvent.findMany({ where: { userId } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ parsedOk: false, templateId, transactionId: null });

    const transactions = await prisma.transaction.findMany({ where: { userId } });
    expect(transactions).toHaveLength(0);
  });

  it("persists an unparsed IngestionEvent when more than one Account is linked to the template", async () => {
    await prisma.account.createMany({
      data: [
        { userId, name: "Cuenta 1", type: "bank", currency: "COP", bankTemplateId: templateId },
        { userId, name: "Cuenta 2", type: "bank", currency: "COP", bankTemplateId: templateId },
      ],
    });

    await processEmail(prisma, { userId, from: senderAddress, text: testEmailBody() });

    const events = await prisma.ingestionEvent.findMany({ where: { userId } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ parsedOk: false, templateId, transactionId: null });

    const transactions = await prisma.transaction.findMany({ where: { userId } });
    expect(transactions).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `corepack pnpm --filter @huella/email-worker test __tests__/processEmail.test.ts`
Expected: FAIL — `Failed to resolve import "../src/processEmail"`.

- [ ] **Step 3: Write `apps/email-worker/src/processEmail.ts`**

```ts
import type { PrismaClient } from "@huella/db";
import { matchTemplate, extractFields } from "@huella/bank-templates";
import type { CreateBankTemplate } from "@huella/shared-types";
import { persistIngestion } from "./persist";

type BankTemplateRow = {
  id: string;
  bankName: string;
  country: string;
  senderPattern: string;
  extractionRules: unknown;
};

function toCreateBankTemplate(row: BankTemplateRow): CreateBankTemplate {
  return {
    bank_name: row.bankName,
    country: row.country,
    sender_pattern: row.senderPattern,
    extraction_rules: row.extractionRules as CreateBankTemplate["extraction_rules"],
  };
}

export async function processEmail(
  prisma: PrismaClient,
  params: { userId: string; from: string; text: string },
): Promise<void> {
  const rows = await prisma.bankTemplate.findMany();
  const mapped = rows.map(toCreateBankTemplate);
  const matched = matchTemplate(params.from, mapped);

  if (!matched) {
    await persistIngestion(prisma, {
      userId: params.userId,
      templateId: null,
      rawContent: params.text,
      transaction: null,
    });
    return;
  }

  const templateRow = rows[mapped.indexOf(matched)];
  const fields = extractFields(matched, params.text);

  if (!fields) {
    await persistIngestion(prisma, {
      userId: params.userId,
      templateId: templateRow.id,
      rawContent: params.text,
      transaction: null,
    });
    return;
  }

  const accounts = await prisma.account.findMany({
    where: { userId: params.userId, bankTemplateId: templateRow.id },
  });

  if (accounts.length !== 1) {
    await persistIngestion(prisma, {
      userId: params.userId,
      templateId: templateRow.id,
      rawContent: params.text,
      transaction: null,
    });
    return;
  }

  const account = accounts[0];

  await persistIngestion(prisma, {
    userId: params.userId,
    templateId: templateRow.id,
    rawContent: params.text,
    transaction: {
      accountId: account.id,
      amount: -fields.amount,
      date: fields.date,
      currency: fields.currency ?? account.currency,
      ...(fields.merchant !== undefined && { merchant: fields.merchant }),
    },
  });
}
```

- [ ] **Step 4: Run the tests again**

Run: `corepack pnpm --filter @huella/email-worker test __tests__/processEmail.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/email-worker/src/processEmail.ts apps/email-worker/__tests__/processEmail.test.ts
git commit -m "feat(email-worker): processEmail"
```

---

## Task 8: `email()` handler wiring

**Files:**
- Modify: `apps/email-worker/src/index.ts`
- Create: `apps/email-worker/__tests__/index.test.ts`

**Interfaces:**
- Consumes: `resolveUser` (Task 4), `parseEmail` (Task 5), `processEmail` (Task 7), `Env` (Task 3).
- Produces: the real Cloudflare Email Worker entry point — what `wrangler deploy` (Fase 7, out of scope here) ships.

This is the end-to-end wiring test: it invokes the actual exported `email()` handler with a synthetic `ForwardableEmailMessage` and a real Hyperdrive-backed Prisma Client (via Miniflare's `env`), proving the whole pipeline — not re-testing every branch already covered by `resolveUser.test.ts` and `processEmail.test.ts`.

- [ ] **Step 1: Write the failing test**

`apps/email-worker/__tests__/index.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import type { ForwardableEmailMessage } from "@cloudflare/workers-types";
import worker from "../src/index";
import { createTestPrisma } from "./testPrisma";
import { bancolombiaCompraRawEmail, rawEmailToStream } from "./fixtures/bancolombiaCompraRaw";

const prisma = createTestPrisma();
let userId: string;

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { email: `wiring-${Date.now()}@example.com`, name: "Test User", defaultCurrency: "COP" },
  });
  userId = user.id;

  const template = await prisma.bankTemplate.upsert({
    where: { senderPattern: "^alertasynotificaciones@bancolombia\\.com\\.co$" },
    update: {},
    create: {
      bankName: "Bancolombia",
      country: "CO",
      senderPattern: "^alertasynotificaciones@bancolombia\\.com\\.co$",
      extractionRules: [
        { field: "amount", pattern: "por \\$([\\d.,]+)", group: 1 },
        { field: "merchant", pattern: "en (.+?) el", group: 1 },
        { field: "date", pattern: "el (\\d{2}/\\d{2}/\\d{4} a las \\d{2}:\\d{2})", group: 1 },
      ],
    },
  });

  await prisma.account.create({
    data: { userId, name: "Cuenta Bancolombia", type: "bank", currency: "COP", bankTemplateId: template.id },
  });
});

afterEach(async () => {
  await prisma.user.delete({ where: { id: userId } });
});

describe("email() end-to-end wiring", () => {
  it("resolves the user, parses the MIME body, and persists a pending Transaction via Hyperdrive", async () => {
    const message = {
      to: `${userId}@ingest.huella.app`,
      raw: rawEmailToStream(bancolombiaCompraRawEmail),
    } as unknown as ForwardableEmailMessage;

    await worker.email(message, env, {} as ExecutionContext);

    const transactions = await prisma.transaction.findMany({ where: { userId } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ amount: -8500000, status: "pending", source: "email" });
  });

  it("does nothing when the recipient doesn't resolve to a user", async () => {
    const message = {
      to: "not-a-real-user@ingest.huella.app",
      raw: rawEmailToStream(bancolombiaCompraRawEmail),
    } as unknown as ForwardableEmailMessage;

    await worker.email(message, env, {} as ExecutionContext);

    const events = await prisma.ingestionEvent.findMany({ where: { rawContent: { contains: "ALMACENES EXITO" } } });
    expect(events).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `corepack pnpm --filter @huella/email-worker test __tests__/index.test.ts`
Expected: FAIL — the placeholder `email()` does nothing, so the first test's `expect(transactions).toHaveLength(1)` fails with `0`.

- [ ] **Step 3: Enable the `driverAdapters` preview feature before writing code that needs it**

`@prisma/adapter-pg` only works if the generated client supports the adapter-accepting constructor, which requires this preview feature. In `packages/db/prisma/schema.prisma`, change:

```prisma
generator client {
  provider = "prisma-client-js"
}
```

to:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}
```

Regenerate: `corepack pnpm --filter @huella/db run prisma:generate`

(This is additive — `apps/api` keeps using a bare `new PrismaClient()` with no adapter, and that continues to work unchanged.)

- [ ] **Step 4: Write `apps/email-worker/src/index.ts`**

```ts
import type { ForwardableEmailMessage } from "@cloudflare/workers-types";
import { PrismaClient } from "@huella/db";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Env } from "./env";
import { resolveUser } from "./resolveUser";
import { parseEmail } from "./parseEmail";
import { processEmail } from "./processEmail";

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const adapter = new PrismaPg({ connectionString: env.HYPERDRIVE.connectionString });
    const prisma = new PrismaClient({ adapter });

    try {
      const userId = await resolveUser(message.to, prisma);
      if (!userId) return;

      const { from, text } = await parseEmail(message.raw);
      await processEmail(prisma, { userId, from, text });
    } finally {
      await prisma.$disconnect();
    }
  },
};
```

- [ ] **Step 5: Run the tests again**

Make sure Postgres is up: `corepack pnpm db:up`

Run: `corepack pnpm --filter @huella/email-worker test __tests__/index.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/email-worker/src/index.ts apps/email-worker/__tests__/index.test.ts packages/db/prisma/schema.prisma
git commit -m "feat(email-worker): wire the email() handler to Hyperdrive + Prisma"
```

---

## Task 9: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full `email-worker` test suite**

Make sure Postgres is up: `corepack pnpm db:up`

Run: `corepack pnpm --filter @huella/email-worker test`
Expected: every test file from Tasks 3–8 passes — 6 files, 16 tests (1 smoke + 4 resolveUser + 2 parseEmail + 2 persist + 5 processEmail + 2 index wiring).

- [ ] **Step 2: Typecheck every touched package**

Run: `corepack pnpm --filter @huella/db run typecheck`
Run: `corepack pnpm --filter @huella/api run typecheck`
Run: `corepack pnpm --filter @huella/email-worker run typecheck`
Expected: no errors on any of the three.

- [ ] **Step 3: Confirm `apps/api` still serves accounts with `bank_template_id`**

Run: `corepack pnpm --filter @huella/api dev` (leave running)

Run: `curl http://127.0.0.1:3000/accounts -H "x-user-id: u10cj1c94sj9o76bqbd4wam0"`
Expected: the accounts created during Task 2's manual verification, each including a `bank_template_id` field (`null` or an id).

Stop the dev server.

- [ ] **Step 4: Re-run the untouched suites to confirm no regressions**

Run: `corepack pnpm --filter @huella/bank-templates test`
Expected: unchanged, all passing (this phase didn't touch `packages/bank-templates`).

Run: `corepack pnpm --filter @huella/mobile test`
Expected: unchanged, all passing (this phase didn't touch `apps/mobile`).

Report any mismatch between these checks and what the automated tests showed before calling the phase done.
