import {describe,it,expect} from "vitest";
import {TokenService} from "../src/modules/auth/token.service.js";

describe("Phase 1 administrator authorization",()=>{
  const make=()=>{
    const tokens=new TokenService("a".repeat(64),"admin-test","admin-test");
    tokens.setAccessValidator(async()=>"ACTIVE");
    return tokens;
  };
  it("accepts a current platform administrator",async()=>{
    const tokens=make();
    tokens.setAdminRoleValidator(async()=>["PLATFORM_ADMIN"]);
    const signed=await tokens.createAccessToken("user-admin",["PLATFORM_ADMIN"]);
    const claims=await tokens.verifyAccessToken(signed.token);
    expect(claims.roles).toContain("PLATFORM_ADMIN");
  });
  it("rejects revoked administrator privileges immediately before token expiry",async()=>{
    const tokens=make();
    const signed=await tokens.createAccessToken("user-admin",["PLATFORM_ADMIN"]);
    tokens.setAdminRoleValidator(async()=>[]);
    await expect(tokens.verifyAccessToken(signed.token)).rejects.toMatchObject({
      code:"ADMIN_ACCESS_REVOKED",statusCode:403,
    });
  });
  it("does not impose admin-role checks on regular users",async()=>{
    const tokens=make();
    tokens.setAdminRoleValidator(async()=>[]);
    const signed=await tokens.createAccessToken("normal-user",[]);
    expect((await tokens.verifyAccessToken(signed.token)).roles).toEqual([]);
  });
  it("suspension overrides an otherwise eligible administrator",async()=>{
    const tokens=make();
    tokens.setAccessValidator(async()=>"SUSPENDED");
    tokens.setAdminRoleValidator(async()=>["PLATFORM_ADMIN"]);
    const signed=await tokens.createAccessToken("user-admin",["PLATFORM_ADMIN"]);
    await expect(tokens.verifyAccessToken(signed.token)).rejects.toMatchObject({
      code:"ACCOUNT_SUSPENDED",statusCode:403,
    });
  });
});
