import type { PrismaClient } from "@huella/db/workerd";
import { Prisma } from "@huella/db/workerd";

type FailedOutcome = {
  userId: string;
  templateId: string | null;
  rawContent: string;
  messageId?: string;
  transaction: null;
};

type SucceededOutcome = {
  userId: string;
  templateId: string;
  rawContent: string;
  messageId?: string;
  transaction: {
    accountId: string;
    amount: number;
    date: string;
    currency: string;
    merchant?: string;
  };
};

export type PersistOutcome = FailedOutcome | SucceededOutcome;

// true si `error` es justo la unique constraint de IngestionEvent.messageId
// disparando — significa que otra invocación concurrente (mismo correo,
// mismo Message-ID) ya persistió este evento primero. Esta constraint es la
// garantía real de idempotencia (no una verificación a nivel de aplicación):
// vale tanto para un reintento secuencial como para dos entregas en paralelo
// del mismo correo.
function isDuplicateMessageId(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function persistIngestion(prisma: PrismaClient, outcome: PersistOutcome): Promise<void> {
  if (outcome.transaction === null) {
    try {
      await prisma.ingestionEvent.create({
        data: {
          userId: outcome.userId,
          templateId: outcome.templateId,
          messageId: outcome.messageId ?? null,
          rawContent: outcome.rawContent,
          parsedOk: false,
        },
      });
    } catch (error) {
      if (!isDuplicateMessageId(error)) throw error;
    }
    return;
  }

  // Both writes must land together: a failure between them would otherwise
  // leave a pending Transaction with no IngestionEvent audit trail, and a
  // Cloudflare retry of a thrown handler would then create a duplicate. If
  // the IngestionEvent insert hits the messageId unique constraint, the
  // whole transaction rolls back — no orphaned Transaction row is possible.
  try {
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
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

      await tx.ingestionEvent.create({
        data: {
          userId: outcome.userId,
          templateId: outcome.templateId,
          transactionId: transaction.id,
          messageId: outcome.messageId ?? null,
          rawContent: outcome.rawContent,
          parsedOk: true,
        },
      });
    });
  } catch (error) {
    if (!isDuplicateMessageId(error)) throw error;
  }
}
