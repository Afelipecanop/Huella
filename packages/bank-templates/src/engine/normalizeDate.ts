// Colombia usa UTC-05:00 todo el año (sin horario de verano), así que un
// offset fijo alcanza: hora UTC = hora Bogotá + 5.
const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4}) a las (\d{2}):(\d{2})$/;

export function normalizeDate(raw: string): string {
  const match = DATE_PATTERN.exec(raw.trim());

  if (!match) {
    throw new Error(`No se pudo interpretar la fecha: "${raw}"`);
  }

  const [, day, month, year, hour, minute] = match;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) + 5,
    Number(minute),
  );

  return new Date(utcMs).toISOString();
}
