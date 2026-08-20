# packages/bank-templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/bank-templates` — a template for Bancolombia's transaction-notification emails plus a generic regex-based engine (`matchTemplate`, `extractFields`) that turns a raw email into extracted transaction fields — and wire it into `apps/api` via a seed script, validating the pattern end-to-end.

**Architecture:** A plain TypeScript/Node package (no runtime framework), mirroring `packages/shared-types`'s build setup (`tsc` + `dist/` output, NodeNext ESM). The engine has three small, independently-testable pieces (`normalizeAmount`, `normalizeDate`, `matchTemplate`) composed by `extractFields`. Static template + fixture data live alongside the engine. `apps/api` consumes the package only in a one-off seed script (`prisma/seed.ts`), not at request-serving runtime.

**Tech Stack:** TypeScript, Vitest (new to this monorepo — see spec for why), Zod (via `@huella/shared-types`, already a dependency), Prisma (schema migration + seed, in `apps/api`).

**Spec:** `docs/superpowers/specs/2026-08-20-bank-templates-design.md`

## Global Constraints

- Package name: `@huella/bank-templates`, added to the pnpm workspace automatically (`packages/*` pattern already in `pnpm-workspace.yaml`).
- TypeScript `strict: true`, `module`/`moduleResolution: NodeNext` — mirror `packages/shared-types/tsconfig.json` exactly.
- All relative imports use explicit `.js` extensions (NodeNext ESM requirement) — see `packages/shared-types/src/index.ts` for the existing convention.
- `extractFields`'s amount output is a **signed-less magnitude in cents** — it never decides expense vs. income. Do not add sign logic anywhere in this package.
- The engine's public functions accept `CreateBankTemplate` (not the full `BankTemplate` with `id`/timestamps) as their template parameter — that's the shape both the static template registry and real DB rows structurally satisfy.
- Amounts are Colombian-peso-formatted strings (`.` = thousands separator, `,` = decimal). Dates are `dd/mm/yyyy a las HH:MM` in `America/Bogota` (fixed `UTC-05:00`, no DST).

---

## Task 1: Scaffold the package

**Files:**
- Create: `packages/bank-templates/package.json`
- Create: `packages/bank-templates/tsconfig.json`
- Create: `packages/bank-templates/vitest.config.ts`
- Create: `packages/bank-templates/src/index.ts` (placeholder, replaced in Task 8)
- Delete: `packages/bank-templates/.gitkeep`

**Interfaces:**
- Produces: a working `@huella/bank-templates` package registered in the pnpm workspace, with `pnpm --filter @huella/bank-templates run typecheck` and `pnpm --filter @huella/bank-templates test` both working (against the placeholder).

- [ ] **Step 1: Remove the placeholder**

```bash
rm packages/bank-templates/.gitkeep
```

- [ ] **Step 2: Write `packages/bank-templates/package.json`**

```json
{
  "name": "@huella/bank-templates",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@huella/shared-types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: Write `packages/bank-templates/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
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

(This mirrors `packages/shared-types/tsconfig.json` exactly — keep them in sync if either changes.)

- [ ] **Step 4: Write `packages/bank-templates/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 5: Write the placeholder `packages/bank-templates/src/index.ts`**

```ts
export {};
```

- [ ] **Step 6: Build `shared-types` (dependency) and install**

```bash
corepack pnpm --filter @huella/shared-types build
corepack pnpm install
```

- [ ] **Step 7: Verify the empty package typechecks and tests**

Run: `corepack pnpm --filter @huella/bank-templates run typecheck`
Expected: exits with no output/errors.

Run: `corepack pnpm --filter @huella/bank-templates test`
Expected: `No test files found` (Vitest exits non-zero on zero tests by default — that's fine here, there are no test files yet; this step is just confirming Vitest itself runs and finds the config).

- [ ] **Step 8: Commit**

```bash
git add packages/bank-templates pnpm-lock.yaml
git commit -m "feat(bank-templates): scaffold package"
```

---

## Task 2: `normalizeAmount`

**Files:**
- Create: `packages/bank-templates/src/engine/normalizeAmount.ts`
- Create: `packages/bank-templates/src/engine/__tests__/normalizeAmount.test.ts`

**Interfaces:**
- Produces: `normalizeAmount(raw: string): number` — throws `Error` on unparseable input. Consumed by `extractFields` (Task 5).

- [ ] **Step 1: Write the failing test**

`packages/bank-templates/src/engine/__tests__/normalizeAmount.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeAmount } from "../normalizeAmount.js";

describe("normalizeAmount", () => {
  it("parses a Colombian-formatted amount with thousands and decimal separators", () => {
    expect(normalizeAmount("85.000,00")).toBe(8500000);
  });

  it("parses an amount with multiple thousands separators", () => {
    expect(normalizeAmount("1.234.567,89")).toBe(123456789);
  });

  it("parses a plain integer amount with no separators", () => {
    expect(normalizeAmount("1000")).toBe(100000);
  });

  it("throws on an unparseable string", () => {
    expect(() => normalizeAmount("no es un monto")).toThrow();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `corepack pnpm --filter @huella/bank-templates test src/engine/__tests__/normalizeAmount.test.ts`
Expected: FAIL — `Failed to resolve import "../normalizeAmount.js"`.

- [ ] **Step 3: Write `packages/bank-templates/src/engine/normalizeAmount.ts`**

```ts
// Los montos vienen en formato colombiano: "." es separador de miles, ","
// es decimal — al revés de lo que asumiría un parseFloat ingenuo.
export function normalizeAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d.,]/g, "");
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);

  if (Number.isNaN(value)) {
    throw new Error(`No se pudo interpretar el monto: "${raw}"`);
  }

  return Math.round(value * 100);
}
```

- [ ] **Step 4: Run the tests again**

Run: `corepack pnpm --filter @huella/bank-templates test src/engine/__tests__/normalizeAmount.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/bank-templates/src/engine/normalizeAmount.ts packages/bank-templates/src/engine/__tests__/normalizeAmount.test.ts
git commit -m "feat(bank-templates): normalizeAmount"
```

---

## Task 3: `normalizeDate`

**Files:**
- Create: `packages/bank-templates/src/engine/normalizeDate.ts`
- Create: `packages/bank-templates/src/engine/__tests__/normalizeDate.test.ts`

**Interfaces:**
- Produces: `normalizeDate(raw: string): string` (ISO 8601 UTC) — throws `Error` on unparseable input. Consumed by `extractFields` (Task 5).

- [ ] **Step 1: Write the failing test**

`packages/bank-templates/src/engine/__tests__/normalizeDate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeDate } from "../normalizeDate.js";

describe("normalizeDate", () => {
  it("converts Bogota local time to UTC (same day)", () => {
    expect(normalizeDate("20/08/2026 a las 14:32")).toBe("2026-08-20T19:32:00.000Z");
  });

  it("rolls over to the next day in UTC when the offset crosses midnight", () => {
    expect(normalizeDate("01/01/2026 a las 20:00")).toBe("2026-01-02T01:00:00.000Z");
  });

  it("throws on an unparseable string", () => {
    expect(() => normalizeDate("no es una fecha")).toThrow();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `corepack pnpm --filter @huella/bank-templates test src/engine/__tests__/normalizeDate.test.ts`
Expected: FAIL — `Failed to resolve import "../normalizeDate.js"`.

- [ ] **Step 3: Write `packages/bank-templates/src/engine/normalizeDate.ts`**

```ts
// Colombia usa UTC-05:00 todo el año (sin horario de verano), así que un
// offset fijo alcanza: hora UTC = hora Bogotá + 5.
const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4}) a las (\d{2}):(\d{2})$/;

export function normalizeDate(raw: string): string {
  const match = DATE_PATTERN.exec(raw.trim());

  if (!match) {
    throw new Error(`No se pudo interpretar la fecha: "${raw}"`);
  }

  const [, day, month, year, hour, minute] = match;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) + 5,
    Number(minute),
  );

  return new Date(utcMs).toISOString();
}
```

- [ ] **Step 4: Run the tests again**

Run: `corepack pnpm --filter @huella/bank-templates test src/engine/__tests__/normalizeDate.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/bank-templates/src/engine/normalizeDate.ts packages/bank-templates/src/engine/__tests__/normalizeDate.test.ts
git commit -m "feat(bank-templates): normalizeDate"
```

---

## Task 4: `matchTemplate`

**Files:**
- Create: `packages/bank-templates/src/engine/matchTemplate.ts`
- Create: `packages/bank-templates/src/engine/__tests__/matchTemplate.test.ts`

**Interfaces:**
- Consumes: `CreateBankTemplate` type from `@huella/shared-types`.
- Produces: `matchTemplate(sender: string, templates: CreateBankTemplate[]): CreateBankTemplate | undefined`. Consumed by Task 7's end-to-end test and, later, `apps/email-worker`.

- [ ] **Step 1: Write the failing test**

`packages/bank-templates/src/engine/__tests__/matchTemplate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { CreateBankTemplate } from "@huella/shared-types";
import { matchTemplate } from "../matchTemplate.js";

const template: CreateBankTemplate = {
  bank_name: "Test Bank",
  country: "CO",
  sender_pattern: "^alerts@testbank\\.com$",
  extraction_rules: [],
};

describe("matchTemplate", () => {
  it("returns the template whose sender_pattern matches the sender", () => {
    expect(matchTemplate("alerts@testbank.com", [template])).toBe(template);
  });

  it("returns undefined when no template matches", () => {
    expect(matchTemplate("someone@other.com", [template])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `corepack pnpm --filter @huella/bank-templates test src/engine/__tests__/matchTemplate.test.ts`
Expected: FAIL — `Failed to resolve import "../matchTemplate.js"`.

- [ ] **Step 3: Write `packages/bank-templates/src/engine/matchTemplate.ts`**

```ts
import type { CreateBankTemplate } from "@huella/shared-types";

export function matchTemplate(
  sender: string,
  templates: CreateBankTemplate[],
): CreateBankTemplate | undefined {
  return templates.find((template) => new RegExp(template.sender_pattern).test(sender));
}
```

- [ ] **Step 4: Run the tests again**

Run: `corepack pnpm --filter @huella/bank-templates test src/engine/__tests__/matchTemplate.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/bank-templates/src/engine/matchTemplate.ts packages/bank-templates/src/engine/__tests__/matchTemplate.test.ts
git commit -m "feat(bank-templates): matchTemplate"
```

---

## Task 5: `extractFields`

**Files:**
- Create: `packages/bank-templates/src/engine/extractFields.ts`
- Create: `packages/bank-templates/src/engine/__tests__/extractFields.test.ts`

**Interfaces:**
- Consumes: `normalizeAmount` (Task 2), `normalizeDate` (Task 3), `CreateBankTemplate`/`ExtractionRule` types from `@huella/shared-types`.
- Produces: `type ExtractedFields = { amount: number; date: string; merchant?: string; currency?: string }`; `extractFields(template: CreateBankTemplate, rawContent: string): ExtractedFields | null`. Consumed by Task 7's end-to-end test and, later, `apps/email-worker`.

- [ ] **Step 1: Write the failing test**

`packages/bank-templates/src/engine/__tests__/extractFields.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { CreateBankTemplate } from "@huella/shared-types";
import { extractFields } from "../extractFields.js";

const template: CreateBankTemplate = {
  bank_name: "Test Bank",
  country: "CO",
  sender_pattern: "^alerts@testbank\\.com$",
  extraction_rules: [
    { field: "amount", pattern: "monto: ([\\d.,]+)", group: 1 },
    { field: "date", pattern: "fecha: (\\d{2}/\\d{2}/\\d{4} a las \\d{2}:\\d{2})", group: 1 },
    { field: "merchant", pattern: "comercio: (.+)", group: 1 },
  ],
};

describe("extractFields", () => {
  it("extracts all matching fields", () => {
    const result = extractFields(
      template,
      "monto: 10.000,00 fecha: 05/01/2026 a las 09:00 comercio: TIENDA X",
    );

    expect(result).toEqual({
      amount: 1000000,
      date: "2026-01-05T14:00:00.000Z",
      merchant: "TIENDA X",
    });
  });

  it("returns null when a required field (amount) doesn't match", () => {
    const result = extractFields(template, "fecha: 05/01/2026 a las 09:00 comercio: TIENDA X");

    expect(result).toBeNull();
  });

  it("returns null when a required field (date) doesn't match", () => {
    const result = extractFields(template, "monto: 10.000,00 comercio: TIENDA X");

    expect(result).toBeNull();
  });

  it("omits an optional field that doesn't match, without failing the extraction", () => {
    const result = extractFields(template, "monto: 10.000,00 fecha: 05/01/2026 a las 09:00");

    expect(result).toEqual({
      amount: 1000000,
      date: "2026-01-05T14:00:00.000Z",
    });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `corepack pnpm --filter @huella/bank-templates test src/engine/__tests__/extractFields.test.ts`
Expected: FAIL — `Failed to resolve import "../extractFields.js"`.

- [ ] **Step 3: Write `packages/bank-templates/src/engine/extractFields.ts`**

```ts
import type { CreateBankTemplate } from "@huella/shared-types";
import { normalizeAmount } from "./normalizeAmount.js";
import { normalizeDate } from "./normalizeDate.js";

export type ExtractedFields = {
  amount: number;
  date: string;
  merchant?: string;
  currency?: string;
};

export function extractFields(
  template: CreateBankTemplate,
  rawContent: string,
): ExtractedFields | null {
  let amount: number | undefined;
  let date: string | undefined;
  let merchant: string | undefined;
  let currency: string | undefined;

  for (const rule of template.extraction_rules) {
    const match = new RegExp(rule.pattern).exec(rawContent);
    const raw = match?.[rule.group];
    if (raw === undefined) continue;

    try {
      switch (rule.field) {
        case "amount":
          amount = normalizeAmount(raw);
          break;
        case "date":
          date = normalizeDate(raw);
          break;
        case "merchant":
          merchant = raw.trim();
          break;
        case "currency":
          currency = raw.trim();
          break;
      }
    } catch {
      // El valor capturado no tiene un formato válido para este campo;
      // queda sin extraer en vez de tirar abajo toda la extracción.
    }
  }

  if (amount === undefined || date === undefined) {
    return null;
  }

  return {
    amount,
    date,
    ...(merchant !== undefined && { merchant }),
    ...(currency !== undefined && { currency }),
  };
}
```

- [ ] **Step 4: Run the tests again**

Run: `corepack pnpm --filter @huella/bank-templates test src/engine/__tests__/extractFields.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/bank-templates/src/engine/extractFields.ts packages/bank-templates/src/engine/__tests__/extractFields.test.ts
git commit -m "feat(bank-templates): extractFields"
```

---

## Task 6: Bancolombia template and email fixture

**Files:**
- Create: `packages/bank-templates/src/templates/bancolombia.ts`
- Create: `packages/bank-templates/src/templates/index.ts`
- Create: `packages/bank-templates/src/templates/__tests__/bancolombia.test.ts`
- Create: `packages/bank-templates/src/fixtures/bancolombia-compra.ts`

**Interfaces:**
- Consumes: `createBankTemplateSchema` from `@huella/shared-types`.
- Produces: `bancolombiaTemplate: CreateBankTemplate` and `templates: CreateBankTemplate[]` (the registry) from `src/templates/*`; `bancolombiaCompraFixture: { from: string; subject: string; body: string }` from `src/fixtures/bancolombia-compra.ts`. Consumed by Task 7's end-to-end test and, later, `apps/api/prisma/seed.ts` (Task 10).

- [ ] **Step 1: Write the failing test**

`packages/bank-templates/src/templates/__tests__/bancolombia.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createBankTemplateSchema } from "@huella/shared-types";
import { bancolombiaTemplate } from "../bancolombia.js";
import { templates } from "../index.js";

describe("bancolombiaTemplate", () => {
  it("is a valid CreateBankTemplate per the shared-types schema", () => {
    expect(() => createBankTemplateSchema.parse(bancolombiaTemplate)).not.toThrow();
  });

  it("has three extraction rules: amount, merchant, date", () => {
    const fields = bancolombiaTemplate.extraction_rules.map((rule) => rule.field);
    expect(fields).toEqual(["amount", "merchant", "date"]);
  });

  it("is included in the templates registry", () => {
    expect(templates).toContain(bancolombiaTemplate);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `corepack pnpm --filter @huella/bank-templates test src/templates/__tests__/bancolombia.test.ts`
Expected: FAIL — `Failed to resolve import "../bancolombia.js"`.

- [ ] **Step 3: Write `packages/bank-templates/src/templates/bancolombia.ts`**

```ts
import type { CreateBankTemplate } from "@huella/shared-types";

// Notificación de "Compra" de Bancolombia. Formato ilustrativo, fabricado a
// partir del shape público conocido de sus alertas transaccionales — no es
// un correo real. Ver src/fixtures/bancolombia-compra.ts para el fixture
// que este patrón está pensado para parsear.
export const bancolombiaTemplate: CreateBankTemplate = {
  bank_name: "Bancolombia",
  country: "CO",
  sender_pattern: "^alertasynotificaciones@bancolombia\\.com\\.co$",
  extraction_rules: [
    { field: "amount", pattern: "por \\$([\\d.,]+)", group: 1 },
    { field: "merchant", pattern: "en (.+?) el", group: 1 },
    { field: "date", pattern: "el (\\d{2}/\\d{2}/\\d{4} a las \\d{2}:\\d{2})", group: 1 },
  ],
};
```

- [ ] **Step 4: Write `packages/bank-templates/src/templates/index.ts`**

```ts
import type { CreateBankTemplate } from "@huella/shared-types";
import { bancolombiaTemplate } from "./bancolombia.js";

export const templates: CreateBankTemplate[] = [bancolombiaTemplate];

export { bancolombiaTemplate } from "./bancolombia.js";
```

- [ ] **Step 5: Write `packages/bank-templates/src/fixtures/bancolombia-compra.ts`**

```ts
// Correo de ejemplo fabricado (no real) para probar bancolombiaTemplate.
export const bancolombiaCompraFixture = {
  from: "alertasynotificaciones@bancolombia.com.co",
  subject: "Bancolombia le informa",
  body: "Bancolombia le informa que ha realizado una Compra por $85.000,00 en ALMACENES EXITO el 20/08/2026 a las 14:32 desde su producto *1234.",
};
```

- [ ] **Step 6: Run the tests again**

Run: `corepack pnpm --filter @huella/bank-templates test src/templates/__tests__/bancolombia.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/bank-templates/src/templates packages/bank-templates/src/fixtures
git commit -m "feat(bank-templates): Bancolombia template and email fixture"
```

---

## Task 7: End-to-end validation

**Files:**
- Create: `packages/bank-templates/src/__tests__/bancolombia-flow.test.ts`

**Interfaces:**
- Consumes: `matchTemplate` (Task 4), `extractFields` (Task 5), `templates` and `bancolombiaCompraFixture` (Task 6).

This is the test that "validates the pattern": the real engine, the real template, a realistic email — no synthetic fixtures.

- [ ] **Step 1: Write the test**

`packages/bank-templates/src/__tests__/bancolombia-flow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { matchTemplate } from "../engine/matchTemplate.js";
import { extractFields } from "../engine/extractFields.js";
import { templates } from "../templates/index.js";
import { bancolombiaCompraFixture } from "../fixtures/bancolombia-compra.js";

describe("Bancolombia template end-to-end", () => {
  it("matches the sender and extracts fields from a realistic purchase notification", () => {
    const template = matchTemplate(bancolombiaCompraFixture.from, templates);
    expect(template).toBeDefined();

    const fields = extractFields(template!, bancolombiaCompraFixture.body);

    expect(fields).toEqual({
      amount: 8500000,
      merchant: "ALMACENES EXITO",
      date: "2026-08-20T19:32:00.000Z",
    });
  });

  it("does not match an unrelated sender", () => {
    expect(matchTemplate("noreply@otherbank.com", templates)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it**

Run: `corepack pnpm --filter @huella/bank-templates test src/__tests__/bancolombia-flow.test.ts`
Expected: PASS, 2 tests. (No RED step here — every piece it composes already has its own tests from Tasks 2–6; this test's job is to prove the composition, not the pieces.)

- [ ] **Step 3: Commit**

```bash
git add packages/bank-templates/src/__tests__
git commit -m "test(bank-templates): end-to-end Bancolombia parsing flow"
```

---

## Task 8: Public exports and full package verification

**Files:**
- Modify: `packages/bank-templates/src/index.ts`

**Interfaces:**
- Produces: the package's public API — everything `apps/api` (Task 10) and, later, `apps/email-worker` import.

- [ ] **Step 1: Replace `packages/bank-templates/src/index.ts`**

```ts
export { matchTemplate } from "./engine/matchTemplate.js";
export { extractFields } from "./engine/extractFields.js";
export type { ExtractedFields } from "./engine/extractFields.js";
export { normalizeAmount } from "./engine/normalizeAmount.js";
export { normalizeDate } from "./engine/normalizeDate.js";
export { templates, bancolombiaTemplate } from "./templates/index.js";
export { bancolombiaCompraFixture } from "./fixtures/bancolombia-compra.js";
```

- [ ] **Step 2: Build and typecheck**

Run: `corepack pnpm --filter @huella/bank-templates run typecheck`
Expected: no errors.

Run: `corepack pnpm --filter @huella/bank-templates run build`
Expected: exits with no errors; `packages/bank-templates/dist/index.js` and `dist/index.d.ts` exist.

- [ ] **Step 3: Run the full package test suite**

Run: `corepack pnpm --filter @huella/bank-templates test`
Expected: all test files from Tasks 2–7 pass (6 files, 18 tests).

- [ ] **Step 4: Commit**

```bash
git add packages/bank-templates/src/index.ts
git commit -m "feat(bank-templates): public exports"
```

---

## Task 9: Prisma migration — unique constraint on `sender_pattern`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_bank_template_sender_unique/migration.sql` (generated by Prisma, not hand-written)

**Interfaces:**
- Produces: a DB-level uniqueness guarantee on `bank_templates.sender_pattern`, required for the upsert-by-sender-pattern seed logic in Task 10.

- [ ] **Step 1: Add the `@unique` attribute**

In `apps/api/prisma/schema.prisma`, in the `BankTemplate` model, change:

```prisma
  senderPattern   String   @map("sender_pattern")
```

to:

```prisma
  senderPattern   String   @unique @map("sender_pattern")
```

- [ ] **Step 2: Generate and apply the migration**

Run: `corepack pnpm --filter @huella/api exec prisma migrate dev --name add_bank_template_sender_unique`
Expected: `Your database is now in sync with your schema.` The `bank_templates` table is currently empty (no rows created in earlier phases), so this migration cannot fail on a duplicate-value conflict.

- [ ] **Step 3: Verify the API still typechecks**

Run: `corepack pnpm --filter @huella/api run typecheck`
Expected: no errors (the Prisma Client types regenerate as part of `migrate dev`; this confirms nothing downstream broke).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(api): unique constraint on bank_templates.sender_pattern"
```

---

## Task 10: Seed script

**Files:**
- Create: `apps/api/prisma/seed.ts`
- Modify: `apps/api/prisma.config.ts`
- Modify: `apps/api/package.json` (add `db:seed` script, add `@huella/bank-templates` dependency)

**Interfaces:**
- Consumes: `templates` from `@huella/bank-templates` (Task 6/8).
- Produces: `bank_templates` rows in the dev database, queryable via the existing `GET /bank-templates` endpoint.

- [ ] **Step 1: Add the workspace dependency**

In `apps/api/package.json`, add to `"dependencies"`:

```json
{
  "dependencies": {
    "@huella/bank-templates": "workspace:*"
  }
}
```

Run: `corepack pnpm install`

- [ ] **Step 2: Write `apps/api/prisma/seed.ts`**

```ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { templates } from "@huella/bank-templates";

const prisma = new PrismaClient();

for (const template of templates) {
  await prisma.bankTemplate.upsert({
    where: { senderPattern: template.sender_pattern },
    update: {
      bankName: template.bank_name,
      country: template.country,
      extractionRules: template.extraction_rules,
    },
    create: {
      bankName: template.bank_name,
      country: template.country,
      senderPattern: template.sender_pattern,
      extractionRules: template.extraction_rules,
    },
  });
}

console.log(`Seed listo: ${templates.length} plantilla(s) de banco.`);

await prisma.$disconnect();
```

- [ ] **Step 3: Wire the seed command into `apps/api/prisma.config.ts`**

Modify to add a `migrations.seed` entry (keep the existing `schema` field):

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
```

- [ ] **Step 4: Add the `db:seed` script**

In `apps/api/package.json`, add to `"scripts"`:

```json
{
  "scripts": {
    "db:seed": "prisma db seed"
  }
}
```

- [ ] **Step 5: Build the bank-templates package so its `dist/` output is resolvable**

Run: `corepack pnpm --filter @huella/bank-templates run build`

(`tsx` resolves workspace dependencies through their published `main`/`types` fields, same as any other `node_modules` package — it does not compile `@huella/bank-templates` on the fly.)

- [ ] **Step 6: Run the seed**

Run: `corepack pnpm --filter @huella/api run db:seed`
Expected: `Seed listo: 1 plantilla(s) de banco.`

- [ ] **Step 7: Verify via the existing API**

Start the API if it isn't already running: `corepack pnpm --filter @huella/api dev`

Run: `curl http://127.0.0.1:3000/bank-templates -H "x-user-id: u10cj1c94sj9o76bqbd4wam0"`
Expected: a JSON array containing one object with `"bank_name": "Bancolombia"`, `"country": "CO"`, and the three `extraction_rules` from Task 6.

- [ ] **Step 8: Re-run the seed to confirm idempotency**

Run: `corepack pnpm --filter @huella/api run db:seed`
Expected: `Seed listo: 1 plantilla(s) de banco.` again, with no duplicate-key error — and the same `curl` from Step 7 still shows exactly one Bancolombia row (upsert, not insert).

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/seed.ts apps/api/prisma.config.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): seed bank templates from @huella/bank-templates"
```

---

## Task 11: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full bank-templates test suite**

Run: `corepack pnpm --filter @huella/bank-templates test`
Expected: every test file from Tasks 2–7 passes (6 files, 18 tests).

- [ ] **Step 2: Typecheck both touched packages**

Run: `corepack pnpm --filter @huella/bank-templates run typecheck`
Expected: no errors.

Run: `corepack pnpm --filter @huella/api run typecheck`
Expected: no errors.

- [ ] **Step 3: Confirm the seeded template is visible end-to-end**

Run: `curl http://127.0.0.1:3000/bank-templates -H "x-user-id: u10cj1c94sj9o76bqbd4wam0"` (API from Task 10, Step 7 still running, or restart it: `corepack pnpm --filter @huella/api dev`)
Expected: the Bancolombia template, matching Task 6's `bancolombiaTemplate`.

Report any mismatch between this manual check and the automated tests before calling the phase done.
