import { describe, expect, it } from "vitest";
import { normalizeDate } from "../normalizeDate.js";

describe("normalizeDate", () => {
  it("converts Bogota local time to UTC (same day)", () => {
    expect(normalizeDate("20/08/2026 a las 14:32")).toBe("2026-08-20T19:32:00.000Z");
  });

  it("rolls over to the next day in UTC when the offset crosses midnight", () => {
    expect(normalizeDate("01/01/2026 a las 20:00")).toBe("2026-01-02T01:00:00.000Z");
  });

  it("throws on an unparseable string", () => {
    expect(() => normalizeDate("no es una fecha")).toThrow();
  });
});
