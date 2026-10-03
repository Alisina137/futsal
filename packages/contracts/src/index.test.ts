import { describe, expect, it } from "vitest";
import { normalizeAfghanistanPhone, registerRequestSchema } from "./index";

describe("shared auth contracts", () => {
  it("normalizes common Afghanistan mobile forms", () => {
    expect(normalizeAfghanistanPhone("0791234567")).toBe("+93791234567");
    expect(normalizeAfghanistanPhone("+93 79 123 4567")).toBe("+93791234567");
  });

  it("accepts player registration input", () => {
    expect(registerRequestSchema.safeParse({
      displayName: "Ahmad",
      phone: "0791234567",
      username: "ahmad_7",
      password: "strong-pass-1",
      preferredLanguage: "fa-AF",
      accountType: "PLAYER",
    }).success).toBe(true);
  });
});
