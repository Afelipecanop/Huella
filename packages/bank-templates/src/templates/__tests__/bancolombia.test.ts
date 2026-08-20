import { describe, expect, it } from "vitest";
import { createBankTemplateSchema } from "@huella/shared-types";
import { bancolombiaTemplate } from "../bancolombia.js";
import { templates } from "../index.js";

describe("bancolombiaTemplate", () => {
  it("is a valid CreateBankTemplate per the shared-types schema", () => {
    expect(() => createBankTemplateSchema.parse(bancolombiaTemplate)).not.toThrow();
  });

  it("has three extraction rules: amount, merchant, date", () => {
    const fields = bancolombiaTemplate.extraction_rules.map((rule) => rule.field);
    expect(fields).toEqual(["amount", "merchant", "date"]);
  });

  it("is included in the templates registry", () => {
    expect(templates).toContain(bancolombiaTemplate);
  });
});
