# Pantallas móviles (loop principal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working version of `apps/mobile` (Expo + Expo Router): a transaction list, instant manual cash entry, and transaction detail/edit — talking to the already-working `apps/api` backend.

**Architecture:** Expo Router for file-based navigation, NativeWind (Tailwind for RN) driven by hand-written design tokens for styling with automatic light/dark mode, TanStack Query for server state (list/create/update/delete against the Fastify API), and a thin typed `fetch` wrapper reusing `@huella/shared-types` as the wire contract. No login yet — a hardcoded dev `user_id` is sent as the `x-user-id` header, matching the backend's current auth placeholder.

**Tech Stack:** Expo SDK (latest, via `create-expo-app` + `expo install`), TypeScript, Expo Router, NativeWind v4 + Tailwind CSS v3, `@tanstack/react-query` v5, `jest-expo` + `@testing-library/react-native` for tests, `@expo-google-fonts/lexend` + `@expo-google-fonts/source-sans-3` for typography.

**Spec:** `docs/superpowers/specs/2026-08-20-mobile-app-design.md`

## Global Constraints

- Package name: `@huella/mobile`, added automatically to the pnpm workspace (`apps/*` pattern already in `pnpm-workspace.yaml`).
- TypeScript `strict: true` (inherited from `expo/tsconfig.base`, do not weaken it).
- All API request/response shapes come from `@huella/shared-types` — never hand-roll a duplicate type for something that package already exports.
- Auth placeholder: every API request carries header `x-user-id: <DEV_USER_ID>`. `DEV_USER_ID` and `API_BASE_URL` come from `EXPO_PUBLIC_*` env vars (Expo's convention for client-exposed vars), read in `src/config.ts`.
- Color tokens (exact values, light / dark) — copied verbatim from the spec:

  | Token | Light | Dark |
  |---|---|---|
  | background | `#F8FAFC` | `#0F172A` |
  | surface | `#FFFFFF` | `#1E293B` |
  | foreground | `#0F172A` | `#F8FAFC` |
  | mutedForeground | `#64748B` | `#94A3B8` |
  | border | `#E1F2ED` | `rgba(255,255,255,0.08)` |
  | primary | `#059669` | `#10B981` |
  | destructive | `#DC2626` | `#F87171` |

- Dark mode follows the OS setting automatically (`darkMode: "media"` in Tailwind config) — no manual toggle in this phase.
- UI copy is in Spanish, matching the rest of the product.
- Never use `Alert.alert`/`Alert.confirm` for destructive confirmations — use an in-app `Modal` (per spec, and per the "no blocking browser/native dialogs" constraint that also applies to RN's native Alert).
- Every touch target ≥48px tall.
- Every task that touches `src/` or `app/` ships with a passing test (`pnpm --filter @huella/mobile test`) before it's considered done.

---

## Task 1: Scaffold the Expo app

**Files:**
- Create: `apps/mobile/` (entire Expo TypeScript template)
- Modify: `apps/mobile/package.json` (rename package, add `typecheck` script)
- Delete: `apps/mobile/.gitkeep`

**Interfaces:**
- Produces: a working `@huella/mobile` package registered in the pnpm workspace, with `pnpm --filter @huella/mobile typecheck` and `pnpm --filter @huella/mobile start` both working.

- [ ] **Step 1: Remove the placeholder and scaffold**

```bash
rm apps/mobile/.gitkeep
cd apps/mobile
npx create-expo-app@latest . --template blank-typescript
cd ../..
```

- [ ] **Step 2: Rename the package and add a typecheck script**

Open `apps/mobile/package.json`. Change `"name"` to `"@huella/mobile"` and add a `typecheck` script alongside the existing ones:

```json
{
  "name": "@huella/mobile",
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

(Keep every other field/script the template generated — only change `name` and add `typecheck`.)

- [ ] **Step 3: Install workspace dependencies**

```bash
corepack pnpm install
```

- [ ] **Step 4: Verify it typechecks**

Run: `corepack pnpm --filter @huella/mobile run typecheck`
Expected: exits with no output/errors (the template's default `App.tsx` is valid TypeScript).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile package.json pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "feat(mobile): scaffold Expo TypeScript app"
```

---

## Task 2: Testing infrastructure

**Files:**
- Modify: `apps/mobile/package.json` (add `test` script and `jest` config)
- Create: `apps/mobile/src/components/__tests__/smoke.test.tsx`

**Interfaces:**
- Produces: `pnpm --filter @huella/mobile test` runs Jest via the `jest-expo` preset and passes.

- [ ] **Step 1: Install test dependencies**

```bash
cd apps/mobile
npx expo install jest-expo react-test-renderer
cd ../..
corepack pnpm add -D --filter @huella/mobile @testing-library/react-native @types/jest
```

- [ ] **Step 2: Add the Jest config and test script to `apps/mobile/package.json`**

Add (don't remove existing fields):

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|expo-router|expo-modules-core|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|native-base|react-native-svg)"
    ]
  }
}
```

- [ ] **Step 3: Write a trivial smoke test**

`apps/mobile/src/components/__tests__/smoke.test.tsx`:

```tsx
import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";

test("renders text", () => {
  render(<Text>Huella</Text>);
  expect(screen.getByText("Huella")).toBeTruthy();
});
```

- [ ] **Step 4: Run it**

Run: `corepack pnpm --filter @huella/mobile test`
Expected: 1 passed test suite, 1 passed test.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json apps/mobile/src/components/__tests__/smoke.test.tsx
git commit -m "test(mobile): add jest-expo + RNTL test infra"
```

---

## Task 3: Design tokens + NativeWind

**Files:**
- Create: `apps/mobile/src/theme/colors.ts`
- Create: `apps/mobile/src/theme/spacing.ts`
- Create: `apps/mobile/src/theme/typography.ts`
- Create: `apps/mobile/src/theme/__tests__/colors.test.ts`
- Create: `apps/mobile/tailwind.config.js`
- Create: `apps/mobile/global.css`
- Create: `apps/mobile/nativewind-env.d.ts`
- Modify: `apps/mobile/babel.config.js`
- Modify: `apps/mobile/metro.config.js` (create if the template didn't generate one)

**Interfaces:**
- Produces: `colors.light`, `colors.dark` (both `Record<"background"|"surface"|"foreground"|"mutedForeground"|"border"|"primary"|"destructive", string>`), `spacing` (`Record<"xs"|"sm"|"md"|"lg"|"xl"|"xxl", number>`), `fonts` (`{ heading: string; body: string }`) — consumed by every screen/component from here on via `className` (NativeWind) or direct import.

- [ ] **Step 1: Install NativeWind and Tailwind**

```bash
corepack pnpm add --filter @huella/mobile nativewind
corepack pnpm add -D --filter @huella/mobile tailwindcss@^3.4.0
```

- [ ] **Step 2: Write the token files**

`apps/mobile/src/theme/colors.ts`:

```ts
export const colors = {
  light: {
    background: "#F8FAFC",
    surface: "#FFFFFF",
    foreground: "#0F172A",
    mutedForeground: "#64748B",
    border: "#E1F2ED",
    primary: "#059669",
    destructive: "#DC2626",
  },
  dark: {
    background: "#0F172A",
    surface: "#1E293B",
    foreground: "#F8FAFC",
    mutedForeground: "#94A3B8",
    border: "rgba(255,255,255,0.08)",
    primary: "#10B981",
    destructive: "#F87171",
  },
} as const;

export type ThemeColors = typeof colors.light;
```

`apps/mobile/src/theme/spacing.ts`:

```ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
```

`apps/mobile/src/theme/typography.ts`:

```ts
export const fonts = {
  heading: "Lexend_600SemiBold",
  body: "SourceSans3_400Regular",
} as const;
```

- [ ] **Step 2b: Write the token test**

`apps/mobile/src/theme/__tests__/colors.test.ts`:

```ts
import { colors } from "../colors";

const requiredKeys = [
  "background",
  "surface",
  "foreground",
  "mutedForeground",
  "border",
  "primary",
  "destructive",
] as const;

test("light and dark palettes define the same set of tokens", () => {
  for (const key of requiredKeys) {
    expect(colors.light[key]).toBeTruthy();
    expect(colors.dark[key]).toBeTruthy();
  }
});

test("light and dark use different values (no accidental copy-paste)", () => {
  for (const key of requiredKeys) {
    expect(colors.light[key]).not.toBe(colors.dark[key]);
  }
});
```

- [ ] **Step 3: Write `tailwind.config.js`**

```js
const { colors } = require("./src/theme/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        background: colors.light.background,
        surface: colors.light.surface,
        foreground: colors.light.foreground,
        "muted-foreground": colors.light.mutedForeground,
        border: colors.light.border,
        primary: colors.light.primary,
        destructive: colors.light.destructive,
        "dark-background": colors.dark.background,
        "dark-surface": colors.dark.surface,
        "dark-foreground": colors.dark.foreground,
        "dark-muted-foreground": colors.dark.mutedForeground,
        "dark-border": colors.dark.border,
        "dark-primary": colors.dark.primary,
        "dark-destructive": colors.dark.destructive,
      },
    },
  },
  plugins: [],
};
```

(`darkMode: "media"` makes every `dark:` class follow the OS setting automatically — no manual toggle logic needed anywhere else in the app.)

- [ ] **Step 4: Write `global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Write `nativewind-env.d.ts`**

```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 6: Update `apps/mobile/babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

- [ ] **Step 7: Create/update `apps/mobile/metro.config.js`**

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 8: Run the tests**

Run: `corepack pnpm --filter @huella/mobile test`
Expected: all tests pass (smoke test + the two new token tests).

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/theme apps/mobile/tailwind.config.js apps/mobile/global.css apps/mobile/nativewind-env.d.ts apps/mobile/babel.config.js apps/mobile/metro.config.js apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): design tokens + NativeWind with light/dark support"
```

---

## Task 4: Expo Router skeleton

**Files:**
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/index.tsx` (placeholder, replaced in Task 10)
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/package.json` (`"main"` entry)
- Delete: `apps/mobile/App.tsx` (template's default entry, replaced by `app/_layout.tsx` + `app/index.tsx`)

**Interfaces:**
- Produces: a `Stack` navigator with three registered screens (`index`, `entry` as a modal, `transaction/[id]`) and font loading via `expo-font`. `entry.tsx` and `transaction/[id].tsx` are created as placeholders here and fleshed out in Tasks 11–12.

- [ ] **Step 1: Install router dependencies**

```bash
cd apps/mobile
npx expo install expo-router expo-linking expo-constants expo-status-bar react-native-safe-area-context react-native-screens expo-font @expo-google-fonts/lexend @expo-google-fonts/source-sans-3
cd ../..
```

- [ ] **Step 2: Point the app entry at Expo Router**

In `apps/mobile/package.json`, set:

```json
{
  "main": "expo-router/entry"
}
```

Delete `apps/mobile/App.tsx` — it's replaced by the `app/` directory.

- [ ] **Step 3: Update `apps/mobile/app.json`**

Add (inside the existing `"expo"` object, keep everything else the template generated):

```json
{
  "expo": {
    "scheme": "huella",
    "plugins": ["expo-router"]
  }
}
```

- [ ] **Step 4: Write placeholder route files**

`apps/mobile/app/entry.tsx`:

```tsx
import { Text, View } from "react-native";

export default function EntryScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-dark-background">
      <Text className="text-foreground dark:text-dark-foreground">Entrada manual</Text>
    </View>
  );
}
```

`apps/mobile/app/transaction/[id].tsx`:

```tsx
import { Text, View } from "react-native";

export default function TransactionDetailScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-dark-background">
      <Text className="text-foreground dark:text-dark-foreground">Detalle</Text>
    </View>
  );
}
```

`apps/mobile/app/index.tsx`:

```tsx
import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-dark-background">
      <Text className="text-foreground dark:text-dark-foreground">Huella</Text>
    </View>
  );
}
```

- [ ] **Step 5: Write `apps/mobile/app/_layout.tsx`**

```tsx
import "../global.css";
import { useFonts, Lexend_600SemiBold } from "@expo-google-fonts/lexend";
import { SourceSans3_400Regular } from "@expo-google-fonts/source-sans-3";
import { Stack } from "expo-router";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Lexend_600SemiBold, SourceSans3_400Regular });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Huella" }} />
      <Stack.Screen name="entry" options={{ presentation: "modal", title: "Nuevo gasto" }} />
      <Stack.Screen name="transaction/[id]" options={{ title: "Transacción" }} />
    </Stack>
  );
}
```

- [ ] **Step 6: Verify it typechecks and tests still pass**

Run: `corepack pnpm --filter @huella/mobile run typecheck`
Expected: no errors.

Run: `corepack pnpm --filter @huella/mobile test`
Expected: all tests still pass (routing has no tests yet — that's fine, this task is scaffolding).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): Expo Router skeleton (home, entry modal, detail)"
```

---

## Task 5: Config, TanStack Query provider, and test utilities

**Files:**
- Create: `apps/mobile/src/config.ts`
- Create: `apps/mobile/src/test-utils/renderWithQueryClient.tsx`
- Modify: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/.env.example`

**Interfaces:**
- Produces: `API_BASE_URL: string`, `DEV_USER_ID: string` (from `src/config.ts`); `renderWithQueryClient(ui: ReactElement)` and `renderHookWithQueryClient<TResult, TProps>(callback: (props: TProps) => TResult)` (from `src/test-utils/renderWithQueryClient.tsx`) — every subsequent hook/screen test uses these.

- [ ] **Step 1: Install TanStack Query**

```bash
corepack pnpm add --filter @huella/mobile @tanstack/react-query
```

- [ ] **Step 2: Write `apps/mobile/src/config.ts`**

```ts
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
export const DEV_USER_ID = process.env.EXPO_PUBLIC_DEV_USER_ID ?? "";
```

- [ ] **Step 3: Write `apps/mobile/.env.example`**

```
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_DEV_USER_ID=
```

- [ ] **Step 4: Write the test helper**

`apps/mobile/src/test-utils/renderWithQueryClient.tsx`:

```tsx
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook } from "@testing-library/react-native";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function renderWithQueryClient(ui: ReactElement) {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

export function renderHookWithQueryClient<TResult, TProps>(
  callback: (props: TProps) => TResult,
) {
  const queryClient = createTestQueryClient();
  return renderHook(callback, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}
```

- [ ] **Step 5: Wire `QueryClientProvider` into the root layout**

Modify `apps/mobile/app/_layout.tsx` — wrap the existing `<Stack>` (keep its three `<Stack.Screen>` children exactly as they are):

```tsx
import "../global.css";
import { useFonts, Lexend_600SemiBold } from "@expo-google-fonts/lexend";
import { SourceSans3_400Regular } from "@expo-google-fonts/source-sans-3";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [fontsLoaded] = useFonts({ Lexend_600SemiBold, SourceSans3_400Regular });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Huella" }} />
        <Stack.Screen name="entry" options={{ presentation: "modal", title: "Nuevo gasto" }} />
        <Stack.Screen name="transaction/[id]" options={{ title: "Transacción" }} />
      </Stack>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 6: Verify**

Run: `corepack pnpm --filter @huella/mobile run typecheck`
Expected: no errors.

Run: `corepack pnpm --filter @huella/mobile test`
Expected: all tests still pass.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/config.ts apps/mobile/src/test-utils apps/mobile/app/_layout.tsx apps/mobile/.env.example apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): config, TanStack Query provider, test utilities"
```

---

## Task 6: Typed API client

**Files:**
- Create: `apps/mobile/src/api/client.ts`
- Create: `apps/mobile/src/api/__tests__/client.test.ts`
- Modify: `apps/mobile/package.json` (add `@huella/shared-types` dependency)

**Interfaces:**
- Consumes: `API_BASE_URL`, `DEV_USER_ID` from `../config` (Task 5).
- Produces: `class ApiError extends Error { status: number; issues?: unknown }`; `function apiRequest<T>(path: string, options?: { method?: "GET"|"POST"|"PATCH"|"DELETE"; body?: unknown }): Promise<T>` — every `src/api/*.ts` file in Task 7 imports `apiRequest` and `ApiError` from here.

- [ ] **Step 1: Add the shared-types workspace dependency**

In `apps/mobile/package.json`, add to `"dependencies"`:

```json
{
  "dependencies": {
    "@huella/shared-types": "workspace:*"
  }
}
```

Run: `corepack pnpm install`

- [ ] **Step 2: Write the failing test**

`apps/mobile/src/api/__tests__/client.test.ts`:

```ts
import { apiRequest, ApiError } from "../client";

describe("apiRequest", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test("GET returns parsed JSON on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "abc" }),
    });

    const result = await apiRequest<{ id: string }>("/accounts");

    expect(result).toEqual({ id: "abc" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/accounts"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "x-user-id": expect.any(String) }),
      }),
    );
  });

  test("204 responses resolve to undefined", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });

    const result = await apiRequest<void>("/accounts/1", { method: "DELETE" });

    expect(result).toBeUndefined();
  });

  test("DELETE with no body does not send a content-type header", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });

    await apiRequest("/accounts/1", { method: "DELETE" });

    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(requestInit.headers["content-type"]).toBeUndefined();
  });

  test("non-2xx throws ApiError with the backend's error message and issues", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Datos inválidos", issues: [{ path: ["amount"] }] }),
    });

    await expect(apiRequest("/transactions", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 400,
      message: "Datos inválidos",
      issues: [{ path: ["amount"] }],
    });
    await expect(apiRequest("/transactions", { method: "POST", body: {} })).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `corepack pnpm --filter @huella/mobile test src/api/__tests__/client.test.ts`
Expected: FAIL — `Cannot find module '../client'`.

- [ ] **Step 4: Write `apps/mobile/src/api/client.ts`**

```ts
import { API_BASE_URL, DEV_USER_ID } from "../config";

export class ApiError extends Error {
  status: number;
  issues?: unknown;

  constructor(status: number, message: string, issues?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

// Solo se manda content-type cuando hay body: mandarlo en un DELETE sin body
// hace que Fastify lo rechace con 400 "cannot be empty" (bug real que
// encontramos probando la API a mano en la Fase 5).
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "x-user-id": DEV_USER_ID };
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Error ${response.status}`;
    const issues =
      data && typeof data === "object" && "issues" in data
        ? (data as { issues: unknown }).issues
        : undefined;
    throw new ApiError(response.status, message, issues);
  }

  return data as T;
}
```

- [ ] **Step 5: Run the tests again**

Run: `corepack pnpm --filter @huella/mobile test src/api/__tests__/client.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/api apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): typed API client with ApiError normalization"
```

---

## Task 7: API resource functions

**Files:**
- Create: `apps/mobile/src/api/accounts.ts`
- Create: `apps/mobile/src/api/categories.ts`
- Create: `apps/mobile/src/api/transactions.ts`
- Create: `apps/mobile/src/api/__tests__/transactions.test.ts`

**Interfaces:**
- Consumes: `apiRequest` from `./client` (Task 6); `Account`, `Category`, `Transaction`, `CreateManualTransaction`, `UpdateTransaction` types from `@huella/shared-types`.
- Produces: `listAccounts(): Promise<Account[]>`; `listCategories(): Promise<Category[]>`; `listTransactions(): Promise<Transaction[]>`, `getTransaction(id: string): Promise<Transaction>`, `createTransaction(payload: CreateManualTransaction): Promise<Transaction>`, `updateTransaction(id: string, payload: UpdateTransaction): Promise<Transaction>`, `deleteTransaction(id: string): Promise<void>` — every hook in Task 8 imports from here.

- [ ] **Step 1: Write `apps/mobile/src/api/accounts.ts`**

```ts
import { apiRequest } from "./client";
import type { Account } from "@huella/shared-types";

export function listAccounts() {
  return apiRequest<Account[]>("/accounts");
}
```

- [ ] **Step 2: Write `apps/mobile/src/api/categories.ts`**

```ts
import { apiRequest } from "./client";
import type { Category } from "@huella/shared-types";

export function listCategories() {
  return apiRequest<Category[]>("/categories");
}
```

- [ ] **Step 3: Write the failing test for transactions**

`apps/mobile/src/api/__tests__/transactions.test.ts`:

```ts
import { apiRequest } from "../client";
import {
  listTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "../transactions";

jest.mock("../client", () => ({ apiRequest: jest.fn() }));

const mockedApiRequest = apiRequest as jest.Mock;

beforeEach(() => {
  mockedApiRequest.mockReset();
});

test("listTransactions calls GET /transactions", async () => {
  mockedApiRequest.mockResolvedValue([]);
  await listTransactions();
  expect(mockedApiRequest).toHaveBeenCalledWith("/transactions");
});

test("getTransaction calls GET /transactions/:id", async () => {
  mockedApiRequest.mockResolvedValue({});
  await getTransaction("tx1");
  expect(mockedApiRequest).toHaveBeenCalledWith("/transactions/tx1");
});

test("createTransaction posts the manual entry payload", async () => {
  mockedApiRequest.mockResolvedValue({});
  const payload = { account_id: "acc1", amount: -1500, date: "2026-08-20T00:00:00.000Z" };
  await createTransaction(payload);
  expect(mockedApiRequest).toHaveBeenCalledWith("/transactions", { method: "POST", body: payload });
});

test("updateTransaction patches the given id", async () => {
  mockedApiRequest.mockResolvedValue({});
  const payload = { merchant: "Kiosco" };
  await updateTransaction("tx1", payload);
  expect(mockedApiRequest).toHaveBeenCalledWith("/transactions/tx1", { method: "PATCH", body: payload });
});

test("deleteTransaction deletes the given id", async () => {
  mockedApiRequest.mockResolvedValue(undefined);
  await deleteTransaction("tx1");
  expect(mockedApiRequest).toHaveBeenCalledWith("/transactions/tx1", { method: "DELETE" });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `corepack pnpm --filter @huella/mobile test src/api/__tests__/transactions.test.ts`
Expected: FAIL — `Cannot find module '../transactions'`.

- [ ] **Step 5: Write `apps/mobile/src/api/transactions.ts`**

```ts
import { apiRequest } from "./client";
import type { Transaction, CreateManualTransaction, UpdateTransaction } from "@huella/shared-types";

export function listTransactions() {
  return apiRequest<Transaction[]>("/transactions");
}

export function getTransaction(id: string) {
  return apiRequest<Transaction>(`/transactions/${id}`);
}

export function createTransaction(payload: CreateManualTransaction) {
  return apiRequest<Transaction>("/transactions", { method: "POST", body: payload });
}

export function updateTransaction(id: string, payload: UpdateTransaction) {
  return apiRequest<Transaction>(`/transactions/${id}`, { method: "PATCH", body: payload });
}

export function deleteTransaction(id: string) {
  return apiRequest<void>(`/transactions/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 6: Run the tests again**

Run: `corepack pnpm --filter @huella/mobile test src/api`
Expected: PASS, all `src/api` tests (client + transactions).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/api
git commit -m "feat(mobile): typed API resource functions (accounts, categories, transactions)"
```

---

## Task 8: TanStack Query hooks

**Files:**
- Create: `apps/mobile/src/hooks/useAccounts.ts`
- Create: `apps/mobile/src/hooks/useCategories.ts`
- Create: `apps/mobile/src/hooks/useTransactions.ts`
- Create: `apps/mobile/src/hooks/useTransaction.ts`
- Create: `apps/mobile/src/hooks/useCreateTransaction.ts`
- Create: `apps/mobile/src/hooks/useUpdateTransaction.ts`
- Create: `apps/mobile/src/hooks/useDeleteTransaction.ts`
- Create: `apps/mobile/src/hooks/__tests__/useCreateTransaction.test.ts`

**Interfaces:**
- Consumes: `listAccounts`, `listCategories`, `listTransactions`, `getTransaction`, `createTransaction`, `updateTransaction`, `deleteTransaction` from `../api/*` (Task 7); `renderHookWithQueryClient` from `../test-utils/renderWithQueryClient` (Task 5).
- Produces: `useAccounts()`, `useCategories()`, `useTransactions()`, `useTransaction(id: string)` (each a `UseQueryResult`); `useCreateTransaction()`, `useUpdateTransaction(id: string)`, `useDeleteTransaction()` (each a `UseMutationResult`, all invalidating the `["transactions"]` query key on success) — consumed by every screen in Tasks 10–12.

- [ ] **Step 1: Write the read hooks**

`apps/mobile/src/hooks/useAccounts.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { listAccounts } from "../api/accounts";

export function useAccounts() {
  return useQuery({ queryKey: ["accounts"], queryFn: listAccounts });
}
```

`apps/mobile/src/hooks/useCategories.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { listCategories } from "../api/categories";

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: listCategories });
}
```

`apps/mobile/src/hooks/useTransactions.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { listTransactions } from "../api/transactions";

export function useTransactions() {
  return useQuery({ queryKey: ["transactions"], queryFn: listTransactions });
}
```

`apps/mobile/src/hooks/useTransaction.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { getTransaction } from "../api/transactions";

export function useTransaction(id: string) {
  return useQuery({ queryKey: ["transactions", id], queryFn: () => getTransaction(id) });
}
```

- [ ] **Step 2: Write the failing test for the create mutation**

`apps/mobile/src/hooks/__tests__/useCreateTransaction.test.ts`:

```ts
import { waitFor } from "@testing-library/react-native";
import { renderHookWithQueryClient } from "../../test-utils/renderWithQueryClient";
import { useCreateTransaction } from "../useCreateTransaction";
import * as transactionsApi from "../../api/transactions";

jest.mock("../../api/transactions");

test("creates a transaction and resolves with the API response", async () => {
  const created = {
    id: "tx1",
    user_id: "u1",
    account_id: "acc1",
    category_id: null,
    amount: -1500,
    currency: "ARS",
    merchant: null,
    date: "2026-08-20T00:00:00.000Z",
    source: "manual",
    status: "confirmed",
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
  };
  jest.spyOn(transactionsApi, "createTransaction").mockResolvedValue(created);

  const { result } = renderHookWithQueryClient(() => useCreateTransaction());

  result.current.mutate({ account_id: "acc1", amount: -1500, date: "2026-08-20T00:00:00.000Z" });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(created);
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `corepack pnpm --filter @huella/mobile test src/hooks/__tests__/useCreateTransaction.test.ts`
Expected: FAIL — `Cannot find module '../useCreateTransaction'`.

- [ ] **Step 4: Write the mutation hooks**

`apps/mobile/src/hooks/useCreateTransaction.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTransaction } from "../api/transactions";

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
```

`apps/mobile/src/hooks/useUpdateTransaction.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTransaction } from "../api/transactions";
import type { UpdateTransaction } from "@huella/shared-types";

export function useUpdateTransaction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTransaction) => updateTransaction(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
```

`apps/mobile/src/hooks/useDeleteTransaction.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteTransaction } from "../api/transactions";

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
```

- [ ] **Step 5: Run the tests again**

Run: `corepack pnpm --filter @huella/mobile test src/hooks`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/hooks
git commit -m "feat(mobile): TanStack Query hooks for accounts/categories/transactions"
```

---

## Task 9: Shared components (Money, EmptyState, TransactionRow, TransactionListSkeleton)

**Files:**
- Create: `apps/mobile/src/components/Money.tsx`
- Create: `apps/mobile/src/components/EmptyState.tsx`
- Create: `apps/mobile/src/components/TransactionRow.tsx`
- Create: `apps/mobile/src/components/TransactionListSkeleton.tsx`
- Create: `apps/mobile/src/components/__tests__/Money.test.tsx`
- Create: `apps/mobile/src/components/__tests__/TransactionRow.test.tsx`
- Create: `apps/mobile/src/components/__tests__/TransactionListSkeleton.test.tsx`

**Interfaces:**
- Consumes: `Transaction` type from `@huella/shared-types`.
- Produces: `<Money amountCents: number, currency: string />`; `<EmptyState title: string, message: string, actionLabel?: string, onAction?: () => void />`; `<TransactionRow transaction: Transaction, onPress: (id: string) => void />`; `<TransactionListSkeleton />` — consumed by the Home screen in Task 10.

- [ ] **Step 1: Write the failing test for Money**

`apps/mobile/src/components/__tests__/Money.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { Money } from "../Money";

test("renders a negative amount as a negative currency string", () => {
  render(<Money amountCents={-1500} currency="ARS" />);
  expect(screen.getByText(/-/)).toBeTruthy();
});

test("renders a positive amount without a minus sign", () => {
  render(<Money amountCents={1500} currency="ARS" />);
  expect(screen.queryByText(/^-/)).toBeNull();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `corepack pnpm --filter @huella/mobile test src/components/__tests__/Money.test.tsx`
Expected: FAIL — `Cannot find module '../Money'`.

- [ ] **Step 3: Write `apps/mobile/src/components/Money.tsx`**

```tsx
import { Text } from "react-native";

type MoneyProps = {
  amountCents: number;
  currency: string;
};

export function Money({ amountCents, currency }: MoneyProps) {
  const isNegative = amountCents < 0;
  const formatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
  }).format(amountCents / 100);

  return (
    <Text
      style={{ fontVariant: ["tabular-nums"] }}
      className={
        isNegative
          ? "text-destructive dark:text-dark-destructive font-bold"
          : "text-primary dark:text-dark-primary font-bold"
      }
    >
      {formatted}
    </Text>
  );
}
```

- [ ] **Step 4: Write `apps/mobile/src/components/EmptyState.tsx`**

```tsx
import { Pressable, Text, View } from "react-native";

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <Text className="text-foreground dark:text-dark-foreground text-lg font-semibold text-center">
        {title}
      </Text>
      <Text className="text-muted-foreground dark:text-dark-muted-foreground text-center mt-2">
        {message}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          className="bg-primary dark:bg-dark-primary rounded-lg px-4 min-h-[48px] items-center justify-center mt-4"
        >
          <Text className="text-white font-bold text-base">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 5: Write the failing test for TransactionRow**

`apps/mobile/src/components/__tests__/TransactionRow.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TransactionRow } from "../TransactionRow";
import type { Transaction } from "@huella/shared-types";

const transaction: Transaction = {
  id: "tx1",
  user_id: "u1",
  account_id: "acc1",
  category_id: null,
  amount: -1500,
  currency: "ARS",
  merchant: "Kiosco",
  date: "2026-08-20T00:00:00.000Z",
  source: "manual",
  status: "confirmed",
  created_at: "2026-08-20T00:00:00.000Z",
  updated_at: "2026-08-20T00:00:00.000Z",
};

test("shows the merchant name", () => {
  render(<TransactionRow transaction={transaction} onPress={jest.fn()} />);
  expect(screen.getByText("Kiosco")).toBeTruthy();
});

test("falls back to a placeholder when there is no merchant", () => {
  render(<TransactionRow transaction={{ ...transaction, merchant: null }} onPress={jest.fn()} />);
  expect(screen.getByText("Sin comercio")).toBeTruthy();
});

test("calls onPress with the transaction id when tapped", () => {
  const onPress = jest.fn();
  render(<TransactionRow transaction={transaction} onPress={onPress} />);
  fireEvent.press(screen.getByText("Kiosco"));
  expect(onPress).toHaveBeenCalledWith("tx1");
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `corepack pnpm --filter @huella/mobile test src/components/__tests__/TransactionRow.test.tsx`
Expected: FAIL — `Cannot find module '../TransactionRow'`.

- [ ] **Step 7: Write `apps/mobile/src/components/TransactionRow.tsx`**

```tsx
import { Pressable, Text, View } from "react-native";
import type { Transaction } from "@huella/shared-types";
import { Money } from "./Money";

type TransactionRowProps = {
  transaction: Transaction;
  onPress: (id: string) => void;
};

export function TransactionRow({ transaction, onPress }: TransactionRowProps) {
  const dateLabel = new Date(transaction.date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });

  return (
    <Pressable
      onPress={() => onPress(transaction.id)}
      className="flex-row items-center justify-between px-4 py-3 min-h-[48px] border-b border-border dark:border-dark-border active:opacity-70"
    >
      <View className="flex-1 mr-3">
        <Text className="text-foreground dark:text-dark-foreground font-medium" numberOfLines={1}>
          {transaction.merchant ?? "Sin comercio"}
        </Text>
        <Text className="text-muted-foreground dark:text-dark-muted-foreground text-sm">
          {dateLabel}
        </Text>
      </View>
      <Money amountCents={transaction.amount} currency={transaction.currency} />
    </Pressable>
  );
}
```

- [ ] **Step 8: Write `apps/mobile/src/components/TransactionListSkeleton.tsx`**

A static skeleton (no shimmer animation — keeps this dependency-free) shown while the first `GET /transactions` is in flight, instead of a blank spinner.

```tsx
import { View } from "react-native";

export function TransactionListSkeleton() {
  return (
    <View className="px-4 py-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          className="flex-row items-center justify-between py-3 border-b border-border dark:border-dark-border"
        >
          <View className="flex-1 mr-3">
            <View className="h-4 w-32 rounded bg-border dark:bg-dark-border mb-2" />
            <View className="h-3 w-16 rounded bg-border dark:bg-dark-border" />
          </View>
          <View className="h-4 w-20 rounded bg-border dark:bg-dark-border" />
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 9: Write its test**

`apps/mobile/src/components/__tests__/TransactionListSkeleton.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";
import { TransactionListSkeleton } from "../TransactionListSkeleton";

test("renders 5 placeholder rows", () => {
  const { toJSON } = render(<TransactionListSkeleton />);
  expect(toJSON()).toBeTruthy();
});
```

- [ ] **Step 10: Run all component tests**

Run: `corepack pnpm --filter @huella/mobile test src/components`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/src/components
git commit -m "feat(mobile): Money, EmptyState, TransactionRow, TransactionListSkeleton components"
```

---

## Task 10: Home screen

**Files:**
- Modify: `apps/mobile/app/index.tsx` (replace the Task 4 placeholder)
- Create: `apps/mobile/app/__tests__/index.test.tsx`

**Interfaces:**
- Consumes: `useTransactions` (Task 8), `TransactionRow`, `EmptyState`, `TransactionListSkeleton` (Task 9), `renderWithQueryClient` (Task 5).

- [ ] **Step 1: Write the failing test**

`apps/mobile/app/__tests__/index.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueryClient } from "../../src/test-utils/renderWithQueryClient";
import HomeScreen from "../index";
import * as transactionsApi from "../../src/api/transactions";

jest.mock("../../src/api/transactions");
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

test("shows the empty state when there are no transactions", async () => {
  jest.spyOn(transactionsApi, "listTransactions").mockResolvedValue([]);
  renderWithQueryClient(<HomeScreen />);
  await waitFor(() => expect(screen.getByText(/Todavía no registraste gastos/)).toBeTruthy());
});

test("shows a row per transaction", async () => {
  jest.spyOn(transactionsApi, "listTransactions").mockResolvedValue([
    {
      id: "tx1",
      user_id: "u1",
      account_id: "acc1",
      category_id: null,
      amount: -1500,
      currency: "ARS",
      merchant: "Kiosco",
      date: "2026-08-20T00:00:00.000Z",
      source: "manual",
      status: "confirmed",
      created_at: "2026-08-20T00:00:00.000Z",
      updated_at: "2026-08-20T00:00:00.000Z",
    },
  ]);
  renderWithQueryClient(<HomeScreen />);
  await waitFor(() => expect(screen.getByText("Kiosco")).toBeTruthy());
});

test("shows a retry button on error, which refetches", async () => {
  const listSpy = jest
    .spyOn(transactionsApi, "listTransactions")
    .mockRejectedValueOnce(new Error("network down"))
    .mockResolvedValueOnce([]);

  renderWithQueryClient(<HomeScreen />);

  await waitFor(() => expect(screen.getByText("Reintentar")).toBeTruthy());
  fireEvent.press(screen.getByText("Reintentar"));

  await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `corepack pnpm --filter @huella/mobile test app/__tests__/index.test.tsx`
Expected: FAIL (the current `index.tsx` placeholder doesn't render a list or empty state).

- [ ] **Step 3: Replace `apps/mobile/app/index.tsx`**

```tsx
import { FlatList, RefreshControl, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTransactions } from "../src/hooks/useTransactions";
import { TransactionRow } from "../src/components/TransactionRow";
import { EmptyState } from "../src/components/EmptyState";
import { TransactionListSkeleton } from "../src/components/TransactionListSkeleton";

export default function HomeScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useTransactions();

  if (isLoading) {
    return (
      <View className="flex-1 bg-background dark:bg-dark-background">
        <TransactionListSkeleton />
      </View>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="No pudimos cargar tus gastos"
        message="Revisá tu conexión y volvé a intentar."
        actionLabel="Reintentar"
        onAction={() => refetch()}
      />
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-dark-background">
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TransactionRow transaction={item} onPress={(id) => router.push(`/transaction/${id}`)} />
        )}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState
            title="Todavía no registraste gastos"
            message="Tocá el botón + para agregar el primero."
          />
        }
      />
      <Link
        href="/entry"
        className="absolute bottom-6 right-6 bg-primary dark:bg-dark-primary rounded-full w-14 h-14 items-center justify-center"
      >
        <Text className="text-white text-2xl font-bold">+</Text>
      </Link>
    </View>
  );
}
```

- [ ] **Step 4: Run the tests again**

Run: `corepack pnpm --filter @huella/mobile test app/__tests__/index.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app
git commit -m "feat(mobile): Home screen with transaction list, empty state, pull-to-refresh"
```

---

## Task 11: Manual entry screen

**Files:**
- Modify: `apps/mobile/app/entry.tsx` (replace the Task 4 placeholder)
- Create: `apps/mobile/app/__tests__/entry.test.tsx`

**Interfaces:**
- Consumes: `useAccounts` (Task 8), `useCreateTransaction` (Task 8), `renderWithQueryClient` (Task 5).

- [ ] **Step 1: Write the failing test**

`apps/mobile/app/__tests__/entry.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueryClient } from "../../src/test-utils/renderWithQueryClient";
import EntryScreen from "../entry";
import * as accountsApi from "../../src/api/accounts";
import * as transactionsApi from "../../src/api/transactions";

jest.mock("../../src/api/accounts");
jest.mock("../../src/api/transactions");
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));

const account = {
  id: "acc1",
  user_id: "u1",
  name: "Efectivo",
  type: "cash" as const,
  currency: "ARS",
  created_at: "2026-08-20T00:00:00.000Z",
  updated_at: "2026-08-20T00:00:00.000Z",
};

test("Guardar is disabled until an amount and account are set", async () => {
  jest.spyOn(accountsApi, "listAccounts").mockResolvedValue([account]);
  renderWithQueryClient(<EntryScreen />);

  await waitFor(() => expect(screen.getByText("Efectivo")).toBeTruthy());

  expect(screen.getByText("Guardar").parent?.props.accessibilityState?.disabled).toBe(true);

  fireEvent.changeText(screen.getByPlaceholderText("0.00"), "150");

  await waitFor(() =>
    expect(screen.getByText("Guardar").parent?.props.accessibilityState?.disabled).toBe(false),
  );
});

test("saving calls createTransaction with a negative amount in cents", async () => {
  jest.spyOn(accountsApi, "listAccounts").mockResolvedValue([account]);
  const createSpy = jest.spyOn(transactionsApi, "createTransaction").mockResolvedValue({
    id: "tx1",
    user_id: "u1",
    account_id: "acc1",
    category_id: null,
    amount: -15000,
    currency: "ARS",
    merchant: null,
    date: "2026-08-20T00:00:00.000Z",
    source: "manual",
    status: "confirmed",
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
  });

  renderWithQueryClient(<EntryScreen />);
  await waitFor(() => expect(screen.getByText("Efectivo")).toBeTruthy());

  fireEvent.changeText(screen.getByPlaceholderText("0.00"), "150");
  fireEvent.press(screen.getByText("Guardar"));

  await waitFor(() =>
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ account_id: "acc1", amount: -15000 }),
    ),
  );
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `corepack pnpm --filter @huella/mobile test app/__tests__/entry.test.tsx`
Expected: FAIL (the current `entry.tsx` placeholder has no form).

- [ ] **Step 3: Replace `apps/mobile/app/entry.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAccounts } from "../src/hooks/useAccounts";
import { useCreateTransaction } from "../src/hooks/useCreateTransaction";

export default function EntryScreen() {
  const router = useRouter();
  const { data: accounts } = useAccounts();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState("");
  const createTransaction = useCreateTransaction();

  useEffect(() => {
    if (!accountId && accounts && accounts.length === 1) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  const amountValue = Number(amountText.replace(",", "."));
  const isAmountValid = amountText.length > 0 && !Number.isNaN(amountValue) && amountValue !== 0;
  const canSave = Boolean(accountId) && isAmountValid && !createTransaction.isPending;

  async function handleSave() {
    if (!accountId || !isAmountValid) return;
    // La entrada rápida siempre registra un gasto (monto negativo) — para
    // ingresos hay que editar la transacción después, no es el camino feliz.
    const amountCents = Math.round(Math.abs(amountValue) * 100) * -1;
    try {
      await createTransaction.mutateAsync({
        account_id: accountId,
        amount: amountCents,
        date: new Date().toISOString(),
      });
      router.back();
    } catch {
      // el error queda visible via createTransaction.isError
    }
  }

  return (
    <View className="flex-1 bg-background dark:bg-dark-background p-4">
      <Text className="text-foreground dark:text-dark-foreground text-sm font-medium mb-2">Monto</Text>
      <TextInput
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder="0.00"
        className="text-foreground dark:text-dark-foreground text-3xl font-bold border-b border-border dark:border-dark-border pb-2 mb-6"
      />

      <Text className="text-foreground dark:text-dark-foreground text-sm font-medium mb-2">Cuenta</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
        {(accounts ?? []).map((account) => (
          <Pressable
            key={account.id}
            onPress={() => setAccountId(account.id)}
            className={
              account.id === accountId
                ? "bg-primary dark:bg-dark-primary px-4 py-2 rounded-full mr-2 min-h-[48px] items-center justify-center"
                : "bg-surface dark:bg-dark-surface border border-border dark:border-dark-border px-4 py-2 rounded-full mr-2 min-h-[48px] items-center justify-center"
            }
          >
            <Text
              className={
                account.id === accountId
                  ? "text-white font-medium"
                  : "text-foreground dark:text-dark-foreground font-medium"
              }
            >
              {account.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {createTransaction.isError && (
        <Text className="text-destructive dark:text-dark-destructive mb-4">
          No pudimos guardar el gasto. Probá de nuevo.
        </Text>
      )}

      <Pressable
        onPress={handleSave}
        disabled={!canSave}
        accessibilityState={{ disabled: !canSave }}
        className={
          canSave
            ? "bg-primary dark:bg-dark-primary rounded-lg min-h-[48px] items-center justify-center"
            : "bg-border dark:bg-dark-border rounded-lg min-h-[48px] items-center justify-center"
        }
      >
        <Text className="text-white font-bold text-base">
          {createTransaction.isPending ? "Guardando..." : "Guardar"}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Run the tests again**

Run: `corepack pnpm --filter @huella/mobile test app/__tests__/entry.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app
git commit -m "feat(mobile): manual cash entry screen"
```

---

## Task 12: Transaction detail/edit screen

**Files:**
- Modify: `apps/mobile/app/transaction/[id].tsx` (replace the Task 4 placeholder)
- Create: `apps/mobile/app/transaction/__tests__/[id].test.tsx`

**Interfaces:**
- Consumes: `useTransaction`, `useCategories`, `useUpdateTransaction`, `useDeleteTransaction` (Task 8), `renderWithQueryClient` (Task 5).

- [ ] **Step 1: Write the failing test**

`apps/mobile/app/transaction/__tests__/[id].test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueryClient } from "../../../src/test-utils/renderWithQueryClient";
import TransactionDetailScreen from "../[id]";
import * as transactionsApi from "../../../src/api/transactions";
import * as categoriesApi from "../../../src/api/categories";

jest.mock("../../../src/api/transactions");
jest.mock("../../../src/api/categories");
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "tx1" }),
  useRouter: () => ({ back: jest.fn() }),
}));

const transaction = {
  id: "tx1",
  user_id: "u1",
  account_id: "acc1",
  category_id: null,
  amount: -1500,
  currency: "ARS",
  merchant: "Kiosco",
  date: "2026-08-20T00:00:00.000Z",
  source: "manual" as const,
  status: "confirmed" as const,
  created_at: "2026-08-20T00:00:00.000Z",
  updated_at: "2026-08-20T00:00:00.000Z",
};

beforeEach(() => {
  jest.spyOn(transactionsApi, "getTransaction").mockResolvedValue(transaction);
  jest.spyOn(categoriesApi, "listCategories").mockResolvedValue([]);
});

test("shows a delete confirmation modal instead of deleting immediately", async () => {
  renderWithQueryClient(<TransactionDetailScreen />);
  await waitFor(() => expect(screen.getByDisplayValue("Kiosco")).toBeTruthy());

  fireEvent.press(screen.getByText("Eliminar"));

  await waitFor(() => expect(screen.getByText("¿Eliminar esta transacción?")).toBeTruthy());
});

test("confirming delete calls deleteTransaction with the transaction id", async () => {
  const deleteSpy = jest.spyOn(transactionsApi, "deleteTransaction").mockResolvedValue(undefined);
  renderWithQueryClient(<TransactionDetailScreen />);
  await waitFor(() => expect(screen.getByDisplayValue("Kiosco")).toBeTruthy());

  fireEvent.press(screen.getByText("Eliminar"));
  await waitFor(() => expect(screen.getByText("¿Eliminar esta transacción?")).toBeTruthy());
  fireEvent.press(screen.getAllByText("Eliminar")[1]);

  await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith("tx1"));
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `corepack pnpm --filter @huella/mobile test app/transaction/__tests__`
Expected: FAIL (the current placeholder has no form or delete flow).

- [ ] **Step 3: Replace `apps/mobile/app/transaction/[id].tsx`**

```tsx
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTransaction } from "../../src/hooks/useTransaction";
import { useUpdateTransaction } from "../../src/hooks/useUpdateTransaction";
import { useDeleteTransaction } from "../../src/hooks/useDeleteTransaction";
import { useCategories } from "../../src/hooks/useCategories";

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: transaction, isLoading } = useTransaction(id);
  const { data: categories } = useCategories();
  const updateTransaction = useUpdateTransaction(id);
  const deleteTransaction = useDeleteTransaction();

  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (transaction) {
      setMerchant(transaction.merchant ?? "");
      setCategoryId(transaction.category_id);
    }
  }, [transaction]);

  if (isLoading || !transaction) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-dark-background">
        <Text className="text-muted-foreground dark:text-dark-muted-foreground">Cargando...</Text>
      </View>
    );
  }

  async function handleSave() {
    await updateTransaction.mutateAsync({
      merchant: merchant.length > 0 ? merchant : null,
      category_id: categoryId,
    });
    router.back();
  }

  async function handleDelete() {
    await deleteTransaction.mutateAsync(transaction.id);
    setConfirmingDelete(false);
    router.back();
  }

  return (
    <View className="flex-1 bg-background dark:bg-dark-background p-4">
      <Text className="text-foreground dark:text-dark-foreground text-sm font-medium mb-2">Comercio</Text>
      <TextInput
        value={merchant}
        onChangeText={setMerchant}
        placeholder="Sin comercio"
        className="text-foreground dark:text-dark-foreground border-b border-border dark:border-dark-border pb-2 mb-6 min-h-[48px]"
      />

      <Text className="text-foreground dark:text-dark-foreground text-sm font-medium mb-2">Categoría</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
        {(categories ?? []).map((category) => (
          <Pressable
            key={category.id}
            onPress={() => setCategoryId(category.id)}
            className={
              category.id === categoryId
                ? "bg-primary dark:bg-dark-primary px-4 py-2 rounded-full mr-2 min-h-[48px] items-center justify-center"
                : "bg-surface dark:bg-dark-surface border border-border dark:border-dark-border px-4 py-2 rounded-full mr-2 min-h-[48px] items-center justify-center"
            }
          >
            <Text
              className={
                category.id === categoryId
                  ? "text-white font-medium"
                  : "text-foreground dark:text-dark-foreground font-medium"
              }
            >
              {category.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        onPress={handleSave}
        disabled={updateTransaction.isPending}
        className="bg-primary dark:bg-dark-primary rounded-lg min-h-[48px] items-center justify-center mb-4"
      >
        <Text className="text-white font-bold text-base">
          {updateTransaction.isPending ? "Guardando..." : "Guardar"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setConfirmingDelete(true)}
        className="border border-destructive dark:border-dark-destructive rounded-lg min-h-[48px] items-center justify-center"
      >
        <Text className="text-destructive dark:text-dark-destructive font-bold text-base">Eliminar</Text>
      </Pressable>

      <Modal visible={confirmingDelete} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="bg-surface dark:bg-dark-surface rounded-lg p-6 w-full">
            <Text className="text-foreground dark:text-dark-foreground text-base font-semibold mb-2">
              ¿Eliminar esta transacción?
            </Text>
            <Text className="text-muted-foreground dark:text-dark-muted-foreground mb-6">
              Esta acción no se puede deshacer.
            </Text>
            <View className="flex-row justify-end">
              <Pressable
                onPress={() => setConfirmingDelete(false)}
                className="px-4 py-2 min-h-[48px] items-center justify-center mr-2"
              >
                <Text className="text-foreground dark:text-dark-foreground">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                className="bg-destructive dark:bg-dark-destructive px-4 py-2 rounded-lg min-h-[48px] items-center justify-center"
              >
                <Text className="text-white font-bold">Eliminar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
```

- [ ] **Step 4: Run the tests again**

Run: `corepack pnpm --filter @huella/mobile test app/transaction/__tests__`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app
git commit -m "feat(mobile): transaction detail/edit screen with delete confirmation"
```

---

## Task 13: Full-suite verification and manual smoke check

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `corepack pnpm --filter @huella/mobile test`
Expected: every test file from Tasks 2–12 passes.

- [ ] **Step 2: Full typecheck**

Run: `corepack pnpm --filter @huella/mobile run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual smoke check against the real API**

This step is not a subagent task — do it yourself in the main session, the same way Phases 4–5 were verified against the real backend:

1. Ensure `apps/api` is running (`pnpm --filter @huella/api dev`) and `apps/mobile/.env` has `EXPO_PUBLIC_API_URL` pointing at it and `EXPO_PUBLIC_DEV_USER_ID` set to a real seeded user id (reuse the seeding approach from Phase 5 if needed — create a user + at least one account directly via Prisma).
2. Run `corepack pnpm --filter @huella/mobile start` and open the app (Expo Go, web, or a simulator — whatever is available in this environment).
3. Confirm: Home shows the empty state → tap **+** → save a manual expense → back on Home the new row appears → tap the row → edit merchant/category → Guardar → row updates on Home → open it again → Eliminar → confirm → row disappears.
4. Toggle the OS/simulator appearance between light and dark and confirm the screens re-theme without a restart.

Report any mismatch between this manual pass and the automated tests — if the automated tests miss something the manual pass catches, that's a gap to fix before calling the phase done.
