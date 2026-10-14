import {randomUUID} from "node:crypto";
import {describe,expect,it} from "vitest";
import {safeNotificationDeepLink} from "../../mobile/src/lib/notification-routing.js";

describe("Notifications Phase 3 — safe native deep links",()=>{
  const id=randomUUID();
  it("accepts specific valid Futsal notification targets",()=>{
    for(const path of [
      "/notifications","/bookings","/dashboard","/support","/owner/schedule",
      "/teams/invitations",`/teams/${id}`,`/teams/${id}/manage`,
      `/teams/${id}/activities`,`/teams/${id}/announcements`,
      `/venues/${id}?startsAt=2026-10-14T18%3A30%3A00.000Z`,
      `/posts/${id}`,`/competitions/${id}`,
    ])expect(safeNotificationDeepLink(path)).toBe(path);
  });
  it("rejects external URLs, traversal, unknown screens, malformed encoding and untrusted data",()=>{
    for(const unsafe of [
      "https://attacker.test","//attacker.test","leaguekick://admin",
      "/admin","/owner/settings","/owner/schedule/../../admin",
      "/venues/not-a-uuid","/teams/not-a-uuid/manage",
      "/owner/schedule#redirect","/teams/../../support",
      "/bookings?return=https://evil.test", "/venues/%2e%2e",
      "/bookings?bad=%ZZ","/bookings?x=1?y=2",
      "/bookings\\redirect","/posts/abc",
      "",null,undefined,{},42,
    ])expect(safeNotificationDeepLink(unsafe)).toBeNull();
  });
});
