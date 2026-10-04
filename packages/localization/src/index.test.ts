import { describe, expect, it } from "vitest";
import { defaultLanguage, getLanguage, isRtlLanguage, languages, translate } from "./index";

describe("LeagueKick localization", () => {
  it("defaults to Dari and marks Dari/Pashto RTL", () => {
    expect(defaultLanguage).toBe("fa-AF");
    expect(isRtlLanguage("fa-AF")).toBe(true);
    expect(isRtlLanguage("ps-AF")).toBe(true);
    expect(isRtlLanguage("en")).toBe(false);
  });

  it("ships all three supported languages", () => {
    expect(languages.map((item) => item.code)).toEqual(["fa-AF", "ps-AF", "en"]);
    expect(getLanguage("ps-AF").nativeName).toBe("پښتو");
  });

  it("interpolates translated values", () => {
    expect(translate("en", "home.greeting", { name: "Ali" })).toBe("Hello, Ali");
    expect(translate("fa-AF", "home.greeting", { name: "علی" })).toContain("علی");
  });

  it("localizes Phase 2 owner onboarding in all supported languages", () => {
    expect(translate("en", "owner.stepOf", { current: 2, total: 8 })).toBe("Step 2 of 8");
    expect(translate("fa-AF", "owner.dashboardTitle")).toBe("داشبورد سالن");
    expect(translate("ps-AF", "owner.startTrial")).toContain("Premium");
  });
});
