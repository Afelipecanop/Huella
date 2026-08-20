import { describe, expect, it } from "vitest";
import { normalizeAmount } from "../normalizeAmount.js";

describe("normalizeAmount", () => {
  it("parses a Colombian-formatted amount with thousands and decimal separators", () => {
    expect(normalizeAmount("85.000,00")).toBe(8500000);
  });

  it("parses an amount with multiple thousands separators", () => {
    expect(normalizeAmount("1.234.567,89")).toBe(123456789);
  });

  it("parses a plain integer amount with no separators", () => {
    expect(normalizeAmount("1000")).toBe(100000);
  });

  it("throws on an unparseable string", () => {
    expect(() => normalizeAmount("no es un monto")).toThrow();
  });

  it("throws on signed input", () => {
    expect(() => normalizeAmount("-85.000,00")).toThrow();
  });
});
