import { describe, expect, it } from "vitest";
import { createBankTemplateSchema } from "@huella/shared-types";
import { bancolombiaTemplate } from "../bancolombia.js";
import { templates } from "../index.js";
import { extractFields } from "../../engine/extractFields.js";

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

describe("bancolombiaTemplate merchant extraction", () => {
  // La versión anterior del patrón de merchant ("en (.+?) el") no estaba
  // anclada al monto ni a la fecha, así que capturaba desde la PRIMERA
  // ocurrencia literal de "en " en el cuerpo del correo. Estos casos
  // prueban que el patrón anclado ("por $... en (.+?) el dd/mm/aaaa...")
  // extrae el merchant correcto incluso cuando el texto anterior contiene
  // su propia "en " y cuando el nombre del merchant contiene " el ".

  it("extracts the merchant correctly when the body has an 'en' before the anchored one", () => {
    const body =
      "Bancolombia le informa que ha realizado una Compra en linea por $85.000,00 en ALMACENES EXITO el 20/08/2026 a las 14:32 desde su producto *1234.";

    const fields = extractFields(bancolombiaTemplate, body);

    expect(fields?.merchant).toEqual("ALMACENES EXITO");
  });

  it("extracts the merchant correctly for a 'Pago en PSE' style body", () => {
    const body =
      "Bancolombia le informa que ha realizado un Pago en PSE por $85.000,00 en NEQUI el 20/08/2026 a las 14:32 desde su producto *1234.";

    const fields = extractFields(bancolombiaTemplate, body);

    expect(fields?.merchant).toEqual("NEQUI");
  });

  it("does not stop early at an ' el ' that is part of the merchant's own name", () => {
    const body =
      "Bancolombia le informa que ha realizado una Compra por $85.000,00 en Tienda el Sol el 20/08/2026 a las 14:32 desde su producto *1234.";

    const fields = extractFields(bancolombiaTemplate, body);

    expect(fields?.merchant).toEqual("Tienda el Sol");
  });
});
