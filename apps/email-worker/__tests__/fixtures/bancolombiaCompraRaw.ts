// Correo crudo fabricado (no real), mismo contenido que
// bancolombiaCompraFixture en @huella/bank-templates pero con headers MIME
// completos, para probar el parseo end-to-end.
export const bancolombiaCompraRawEmail = [
  "From: alertasynotificaciones@bancolombia.com.co",
  "To: u10cj1c94sj9o76bqbd4wam0@ingest.huella.app",
  "Subject: Bancolombia le informa",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Bancolombia le informa que ha realizado una Compra por $85.000,00 en ALMACENES EXITO el 20/08/2026 a las 14:32 desde su producto *1234.",
  "",
].join("\r\n");

export function rawEmailToStream(raw: string): ReadableStream<Uint8Array> {
  return new Response(raw).body!;
}
