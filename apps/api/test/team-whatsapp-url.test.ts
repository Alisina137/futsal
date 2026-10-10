import {describe,expect,it} from "vitest";
import {whatsappGroupUrlSchema} from "../src/modules/team/team-manager-phase1.routes.js";
describe("WhatsApp team invite link validation",()=>{
  const token="AbCdEfGhIjKlMnOpQrStUv";
  it("accepts real group invite links and removes WhatsApp tracking parameters",()=>{
    expect(whatsappGroupUrlSchema.parse("https://chat.whatsapp.com/"+token)).toBe("https://chat.whatsapp.com/"+token);
    expect(whatsappGroupUrlSchema.parse(" https://chat.whatsapp.com/"+token+"?mode=ems_copy_t ")).toBe("https://chat.whatsapp.com/"+token);
    expect(whatsappGroupUrlSchema.parse(null)).toBe(null);
    expect(whatsappGroupUrlSchema.parse("")).toBe(null);
  });
  it("rejects spoofed links, wrong groups, and dangerous schemes",()=>{
    for(const value of ["http://chat.whatsapp.com/"+token,
      "https://chat.whatsapp.com.evil.example/"+token,
      "https://evil.example/"+token,"https://chat.whatsapp.com/"+token+"/extra",
      "https://chat.whatsapp.com/abcd","javascript:alert(1)",
      "https://chat.whatsapp.com/"+token+"#fragment",
      "https://user@chat.whatsapp.com/"+token]){
      expect(()=>whatsappGroupUrlSchema.parse(value)).toThrow();
    }
  });
});
