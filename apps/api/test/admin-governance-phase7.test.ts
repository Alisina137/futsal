import {describe,expect,it} from "vitest";
import {adminAuditFilterSchema,platformSettingsUpdateRequestSchema} from "@leaguekick/contracts";
import {restrictMetadata,escaped} from "../src/modules/commercial/admin-governance.repository.js";
describe("Admin Phase 7 privacy and governance pure guards",()=>{
 it("redacts arbitrary notes, phone numbers, token fields and template bodies",()=>{
   const detail=restrictMetadata({
     action:"UPDATED",status:"ACTIVE",changedKeys:["monthlyPriceAfn","notificationTemplates"],
     phone:"+93700000000",password:"123",sessionSecret:"secret",
     reason:"Sensitive complaint describing a customer",providerReference:"real payment proof",
     notificationTemplateBody:"Temporary code: 123456",
     oldMonthlyPriceAfn:1000,newMonthlyPriceAfn:1400,
     untrustedNested:{password:"unsafe"},
   });
   expect(detail).toEqual({
     action:"UPDATED",status:"ACTIVE",
     changedKeys:["monthlyPriceAfn","notificationTemplates"],
     oldMonthlyPriceAfn:1000,newMonthlyPriceAfn:1400,
   });
   expect(JSON.stringify(detail)).not.toContain("Sensitive complaint");
   expect(JSON.stringify(detail)).not.toContain("secret");
 });
 it("quotes commas, quotes, line breaks and formula-like CSV values",()=>{
   expect(escaped("=HYPERLINK(\"https://evil.example\",\"click\")"))
     .toBe("\"'=HYPERLINK(\"\"https://evil.example\"\",\"\"click\"\")\"");
   expect(escaped("+SUM(A1:A2)")).toBe("\"'+SUM(A1:A2)\"");
   expect(escaped("@DATA")).toBe("\"'@DATA\"");
   expect(escaped("multi\nline,\"quoted\"")).toBe("\"multi line,\"\"quoted\"\"\"");
   expect(escaped(null)).toBe("\"\"");
 });
 it("requires bounded audit filters and versioned reason-gated settings updates",()=>{
   expect(adminAuditFilterSchema.safeParse({page:0}).success).toBe(false);
   expect(adminAuditFilterSchema.safeParse({pageSize:101}).success).toBe(false);
   expect(adminAuditFilterSchema.safeParse({from:"2026-10-11",to:"2026-10-10"}).success).toBe(false);
   const base={monthlyPriceAfn:1000,annualPriceAfn:12000,trialDurationHours:72,
     featureFlags:{},notificationTemplates:{}};
   expect(platformSettingsUpdateRequestSchema.safeParse(base).success).toBe(false);
   expect(platformSettingsUpdateRequestSchema.safeParse({...base,reason:"",expectedUpdatedAt:"2026-10-11T10:00:00.000Z"}).success).toBe(false);
   expect(platformSettingsUpdateRequestSchema.safeParse({...base,
     reason:"Reviewed new subscriber pricing.",expectedUpdatedAt:"2026-10-11T10:00:00.000Z"}).success).toBe(true);
   expect(platformSettingsUpdateRequestSchema.safeParse({...base,
     reason:"Reviewed new subscriber pricing.",expectedUpdatedAt:"2026-10-11T10:00:00.000Z",
     notificationTemplates:{"bad key":"body"}}).success).toBe(false);
 });
});
