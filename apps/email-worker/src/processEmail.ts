import type { PrismaClient } from "@huella/db/workerd";
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

// Postgres `integer` range — Transaction.amount is stored in minor units (cents).
const POSTGRES_INT32_MAX = 2147483647;

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
  const amount = -fields.amount;

  // A value this large can't be a real bank-notification amount for a single
  // purchase — treat it the same as any other extraction failure rather than
  // letting the DB write throw (Transaction.amount is a 32-bit Postgres `integer`).
  if (Math.abs(amount) > POSTGRES_INT32_MAX) {
    await persistIngestion(prisma, {
      userId: params.userId,
      templateId: templateRow.id,
      rawContent: params.text,
      transaction: null,
    });
    return;
  }

  // extractFields doesn't validate currency format; guard before writing so
  // a malformed capture can't poison Transaction.currency (@db.Char(3)) and
  // break every later read of this user's transaction list.
  const currency =
    fields.currency && /^[A-Z]{3}$/.test(fields.currency) ? fields.currency : account.currency;

  await persistIngestion(prisma, {
    userId: params.userId,
    templateId: templateRow.id,
    rawContent: params.text,
    transaction: {
      accountId: account.id,
      amount,
      date: fields.date,
      currency,
      ...(fields.merchant !== undefined && { merchant: fields.merchant }),
    },
  });
}
