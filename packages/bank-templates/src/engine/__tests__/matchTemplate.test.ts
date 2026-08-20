import { describe, expect, it } from "vitest";
import type { CreateBankTemplate } from "@huella/shared-types";
import { matchTemplate } from "../matchTemplate.js";

const template: CreateBankTemplate = {
  bank_name: "Test Bank",
  country: "CO",
  sender_pattern: "^alerts@testbank\\.com$",
  extraction_rules: [],
};

describe("matchTemplate", () => {
  it("returns the template whose sender_pattern matches the sender", () => {
    expect(matchTemplate("alerts@testbank.com", [template])).toBe(template);
  });

  it("returns undefined when no template matches", () => {
    expect(matchTemplate("someone@other.com", [template])).toBeUndefined();
  });
});
