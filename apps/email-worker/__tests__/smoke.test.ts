import { describe, expect, it } from "vitest";
import worker from "../src/index";

describe("email-worker scaffold", () => {
  it("exports an email handler", () => {
    expect(typeof worker.email).toBe("function");
  });
});
