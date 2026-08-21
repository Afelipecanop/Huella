import { describe, expect, it } from "vitest";
import { parseEmail } from "../src/parseEmail";
import { bancolombiaCompraRawEmail, rawEmailToStream } from "./fixtures/bancolombiaCompraRaw";

describe("parseEmail", () => {
  it("extracts the sender and plain-text body from raw MIME", async () => {
    const result = await parseEmail(rawEmailToStream(bancolombiaCompraRawEmail));

    expect(result.from).toBe("alertasynotificaciones@bancolombia.com.co");
    expect(result.text).toContain("Compra por $85.000,00 en ALMACENES EXITO");
  });

  it("falls back to stripped HTML when there is no plain-text part", async () => {
    const htmlOnly = [
      "From: alerts@testbank.com",
      "To: someone@ingest.huella.app",
      "Subject: Test",
      "Content-Type: text/html; charset=utf-8",
      "",
      "<p>Compra por <b>$10.000,00</b> en TIENDA</p>",
      "",
    ].join("\r\n");

    const result = await parseEmail(rawEmailToStream(htmlOnly));

    expect(result.text).toContain("Compra por");
    expect(result.text).toContain("$10.000,00");
    expect(result.text).not.toContain("<b>");
  });
});
