import { describe, expect, it } from "vitest";
import { matchTemplate } from "../engine/matchTemplate.js";
import { extractFields } from "../engine/extractFields.js";
import { templates } from "../templates/index.js";
import { bancolombiaCompraFixture } from "../fixtures/bancolombia-compra.js";

describe("Bancolombia template end-to-end", () => {
  it("matches the sender and extracts fields from a realistic purchase notification", () => {
    const template = matchTemplate(bancolombiaCompraFixture.from, templates);
    expect(template).toBeDefined();

    const fields = extractFields(template!, bancolombiaCompraFixture.body);

    expect(fields).toEqual({
      amount: 8500000,
      merchant: "ALMACENES EXITO",
      date: "2026-08-20T19:32:00.000Z",
    });
  });

  it("does not match an unrelated sender", () => {
    expect(matchTemplate("noreply@otherbank.com", templates)).toBeUndefined();
  });
});
