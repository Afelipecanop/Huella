import type { PrismaClient } from "@huella/db/workerd";

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
