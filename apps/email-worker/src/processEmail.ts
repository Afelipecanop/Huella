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
