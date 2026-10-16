import {describe,expect,it} from "vitest";
import {teamLogoInput} from "../src/modules/team/team-manager-phase1.routes.js";
describe("Team Manager Phase 8 logo security",()=>{
  const path="/api/v1/social/post-images/11111111-1111-4111-8111-111111111111/"+("a".repeat(32));
  it("accepts only internal uploaded image references and explicit removal",()=>{
    expect(teamLogoInput.parse({imageUrl:path})).toEqual({imageUrl:path});
    expect(teamLogoInput.parse({imageUrl:null})).toEqual({imageUrl:null});
  });
  it("rejects third-party, insecure, or malformed image references",()=>{
    const invalid=[
      "https://example.com/photo.png","http://example.com/photo.png",
      "javascript:alert(1)","/api/v1/social/post-images/../../etc/passwd",
      "/api/v1/social/post-images/not-a-uuid/"+("a".repeat(32)),
      "/api/v1/social/post-images/11111111-1111-4111-8111-111111111111/short",
    ];
    for(const imageUrl of invalid)expect(teamLogoInput.safeParse({imageUrl}).success).toBe(false);
    expect(teamLogoInput.safeParse({}).success).toBe(false);
  });
});
