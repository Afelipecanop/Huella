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
