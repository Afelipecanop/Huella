import { describe, expect, it } from "vitest";
import type { CreateBankTemplate } from "@huella/shared-types";
import { extractFields } from "../extractFields.js";

const template: CreateBankTemplate = {
  bank_name: "Test Bank",
  country: "CO",
  sender_pattern: "^alerts@testbank\\.com$",
  extraction_rules: [
    { field: "amount", pattern: "monto: ([\\d.,]+)", group: 1 },
    { field: "date", pattern: "fecha: (\\d{2}/\\d{2}/\\d{4} a las \\d{2}:\\d{2})", group: 1 },
    { field: "merchant", pattern: "comercio: (.+)", group: 1 },
  ],
};

describe("extractFields", () => {
  it("extracts all matching fields", () => {
    const result = extractFields(
      template,
      "monto: 10.000,00 fecha: 05/01/2026 a las 09:00 comercio: TIENDA X",
    );

    expect(result).toEqual({
      amount: 1000000,
      date: "2026-01-05T14:00:00.000Z",
      merchant: "TIENDA X",
    });
  });

  it("returns null when a required field (amount) doesn't match", () => {
    const result = extractFields(template, "fecha: 05/01/2026 a las 09:00 comercio: TIENDA X");

    expect(result).toBeNull();
  });

  it("returns null when a required field (date) doesn't match", () => {
    const result = extractFields(template, "monto: 10.000,00 comercio: TIENDA X");

    expect(result).toBeNull();
  });

  it("omits an optional field that doesn't match, without failing the extraction", () => {
    const result = extractFields(template, "monto: 10.000,00 fecha: 05/01/2026 a las 09:00");

    expect(result).toEqual({
      amount: 1000000,
      date: "2026-01-05T14:00:00.000Z",
    });
  });
});
