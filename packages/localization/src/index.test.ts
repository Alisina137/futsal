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

  it("localizes every notification event type, including system and team actions",()=>{
    const types=[
      "BOOKING_CONFIRMED","BOOKING_CANCELLED","BOOKING_REQUEST",
      "TEAM_JOIN_REQUEST","TEAM_JOIN_DECISION","SLOT_AVAILABLE","SLOT_PROMOTION",
      "VENUE_POST","TEAM_INVITATION","COMPETITION_UPDATE",
      "TEAM_ACTIVITY","TEAM_CHALLENGE","TEAM_ANNOUNCEMENT","ADMIN_ANNOUNCEMENT",
    ] as const;
    for(const language of ["en","fa-AF","ps-AF"] as const){
      for(const type of types){
        const key=`notifications.type.${type}` as const;
        const label=translate(language,key);
        expect(label.length).toBeGreaterThan(1);
        expect(label).not.toEqual(key);
        expect(label).not.toContain("undefined");
      }
      for(const key of ["notifications.message.slotAvailable","notifications.message.slotPromotion",
        "notifications.body.TEAM_ACTIVITY","notifications.body.TEAM_CHALLENGE",
        "notifications.body.TEAM_ANNOUNCEMENT","notifications.body.ADMIN_ANNOUNCEMENT"] as const){
        expect(translate(language,key)).not.toBe(key);
      }
      const available=translate(language,"notifications.message.slotAvailable",{
        venue:"Kabul Arena",date:"Oct 14, 2026",time:"06:30 PM",
      });
      expect(available).toContain("Kabul Arena");
      expect(available).toContain("06:30 PM");
      expect(available).not.toContain("{time}");
      const promotion=translate(language,"notifications.message.slotPromotion",{venue:"Herat Sports"});
      expect(promotion).toContain("Herat Sports");
      expect(promotion).not.toContain("{venue}");
    }
  });

  it("localizes Phase 2 owner onboarding in all supported languages", () => {
    expect(translate("en", "owner.stepOf", { current: 2, total: 8 })).toBe("Step 2 of 8");
    expect(translate("fa-AF", "owner.dashboardTitle")).toBe("داشبورد سالن");
    expect(translate("ps-AF", "owner.startTrial")).toContain("Premium");
  });
});
