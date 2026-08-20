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
