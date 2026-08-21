import type {
  User as PrismaUser,
  Account as PrismaAccount,
  Category as PrismaCategory,
  Transaction as PrismaTransaction,
  IngestionEvent as PrismaIngestionEvent,
  BankTemplate as PrismaBankTemplate,
} from "@huella/db";
import {
  userSchema,
  accountSchema,
  categorySchema,
  transactionSchema,
  ingestionEventSchema,
  bankTemplateSchema,
} from "@huella/shared-types";

// Traduce el modelo de Prisma (camelCase) al contrato de la API
// (snake_case, definido por los esquemas Zod de shared-types), validando
// en el proceso que la forma sea correcta.

export function serializeUser(u: PrismaUser) {
  return userSchema.parse({
    id: u.id,
    email: u.email,
    name: u.name,
    default_currency: u.defaultCurrency,
    created_at: u.createdAt.toISOString(),
    updated_at: u.updatedAt.toISOString(),
  });
}

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

export function serializeCategory(c: PrismaCategory) {
  return categorySchema.parse({
    id: c.id,
    user_id: c.userId,
    parent_id: c.parentId,
    name: c.name,
    type: c.type,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  });
}

export function serializeTransaction(t: PrismaTransaction) {
  return transactionSchema.parse({
    id: t.id,
    user_id: t.userId,
    account_id: t.accountId,
    category_id: t.categoryId,
    amount: t.amount,
    currency: t.currency,
    merchant: t.merchant,
    date: t.date.toISOString(),
    source: t.source,
    status: t.status,
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
  });
}

export function serializeIngestionEvent(e: PrismaIngestionEvent) {
  return ingestionEventSchema.parse({
    id: e.id,
    user_id: e.userId,
    template_id: e.templateId,
    transaction_id: e.transactionId,
    raw_content: e.rawContent,
    parsed_ok: e.parsedOk,
    created_at: e.createdAt.toISOString(),
  });
}

export function serializeBankTemplate(b: PrismaBankTemplate) {
  return bankTemplateSchema.parse({
    id: b.id,
    bank_name: b.bankName,
    country: b.country,
    sender_pattern: b.senderPattern,
    extraction_rules: b.extractionRules,
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  });
}
