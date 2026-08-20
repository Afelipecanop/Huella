// Los montos vienen en formato colombiano: "." es separador de miles, ","
// es decimal — al revés de lo que asumiría un parseFloat ingenuo.
export function normalizeAmount(raw: string): number {
  if (raw.includes("-")) {
    throw new Error(`No se pudo interpretar el monto: "${raw}"`);
  }

  const cleaned = raw.replace(/[^\d.,]/g, "");
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);

  if (Number.isNaN(value)) {
    throw new Error(`No se pudo interpretar el monto: "${raw}"`);
  }

  return Math.round(value * 100);
}
