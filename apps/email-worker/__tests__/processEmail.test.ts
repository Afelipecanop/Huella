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
    data: {
      email: `process-${suffix}@example.com`,
      passwordHash: "unused",
      name: "Test User",
      defaultCurrency: "COP",
    },
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

  it("falls back to the account's currency when the extracted currency isn't a valid 3-letter code", async () => {
    const account = await prisma.account.create({
      data: { userId, name: "Cuenta test", type: "bank", currency: "COP", bankTemplateId: templateId },
    });

    await prisma.bankTemplate.update({
      where: { id: templateId },
      data: {
        extractionRules: [
          ...TEST_BANK_RULES,
          { field: "currency", pattern: "moneda: (.+)", group: 1 },
        ],
      },
    });

    await processEmail(prisma, {
      userId,
      from: senderAddress,
      text: `${testEmailBody()} moneda: pesos colombianos`,
    });

    const transactions = await prisma.transaction.findMany({ where: { userId } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ currency: "COP", accountId: account.id });
  });

  it("persists an unparsed IngestionEvent instead of overflowing Postgres's 32-bit amount column", async () => {
    await prisma.account.create({
      data: { userId, name: "Cuenta test", type: "bank", currency: "COP", bankTemplateId: templateId },
    });

    // 30,000,000.00 COP -> 3,000,000,000 cents, past Postgres's int32 max (2,147,483,647).
    await processEmail(prisma, {
      userId,
      from: senderAddress,
      text: "monto: 30.000.000,00 fecha: 05/01/2026 a las 09:00 comercio: TIENDA X",
    });

    const transactions = await prisma.transaction.findMany({ where: { userId } });
    expect(transactions).toHaveLength(0);

    const events = await prisma.ingestionEvent.findMany({ where: { userId } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ parsedOk: false, templateId, transactionId: null });
  });
});
