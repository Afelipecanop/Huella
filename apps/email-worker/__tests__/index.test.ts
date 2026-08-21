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

  it("never throws and still persists a failed IngestionEvent when a BankTemplate row has an invalid regex", async () => {
    // A malformed sender_pattern makes matchTemplate's `new RegExp(...)` throw
    // a SyntaxError before any of processEmail's own branches run — the
    // email() handler's error boundary must catch this and persist a
    // fallback IngestionEvent instead of losing the message.
    //
    // Remove the valid Bancolombia template this file's beforeEach upserts
    // first: matchTemplate scans every BankTemplate row via Array.find, which
    // short-circuits at the first *match* (not the first error) — with the
    // valid row still present, whether the bad row is ever reached would
    // depend on unspecified query row order. The next test's beforeEach
    // re-upserts this row, so removing it here doesn't affect other tests.
    await prisma.bankTemplate.deleteMany({
      where: { senderPattern: "^alertasynotificaciones@bancolombia\\.com\\.co$" },
    });

    const badTemplate = await prisma.bankTemplate.create({
      data: {
        bankName: "Broken Bank",
        country: "CO",
        senderPattern: `(unclosed-${Date.now()}`,
        extractionRules: [],
      },
    });

    try {
      const message = {
        to: `${userId}@ingest.huella.app`,
        raw: rawEmailToStream(bancolombiaCompraRawEmail),
      } as unknown as ForwardableEmailMessage;

      await expect(worker.email(message, env, {} as ExecutionContext)).resolves.toBeUndefined();

      const events = await prisma.ingestionEvent.findMany({ where: { userId } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ parsedOk: false, templateId: null, transactionId: null });

      const transactions = await prisma.transaction.findMany({ where: { userId } });
      expect(transactions).toHaveLength(0);
    } finally {
      await prisma.bankTemplate.delete({ where: { id: badTemplate.id } });
    }
  });
});
