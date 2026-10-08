import { describe, expect, it } from "vitest";
import { selectPersonalizedSocialPosts } from "../src/modules/marketing/social-feed-ranking.js";

type Post={id:string;entityType:"VENUE"|"TEAM";entityId:string;visibility:"PUBLIC"|"FOLLOWERS"|"PRIVATE"};

const post=(id:string,entityId:string,visibility:Post["visibility"]="PUBLIC"):Post=>({
  id,entityType:"VENUE",entityId,visibility,
});

describe("public discovery and followed social feed ordering",()=>{
  it("shows public posts to new users without existing follows",()=>{
    const rows=[post("1","public-a"),post("2","private-a","FOLLOWERS"),post("3","public-b")];
    expect(selectPersonalizedSocialPosts(rows,new Set())).toEqual([rows[0],rows[2]]);
  });

  it("prioritizes followed accounts while adding public recommendations",()=>{
    const rows=[
      post("unfollowed-new","other"),
      post("follow-1","mine"),
      post("follow-2","mine","FOLLOWERS"),
      post("follow-3","mine"),
      post("unfollowed-old","other"),
      post("follow-4","mine"),
    ];
    expect(selectPersonalizedSocialPosts(rows,new Set(["VENUE:mine"])).map(x=>x.id)).toEqual([
      "follow-1","follow-2","follow-3","unfollowed-new","follow-4","unfollowed-old",
    ]);
  });

  it("does not recommend follower-only or private posts",()=>{
    const rows=[
      post("followers-only","other","FOLLOWERS"),
      post("private","mine","PRIVATE"),
      post("visible","mine","FOLLOWERS"),
      post("public","other"),
    ];
    expect(selectPersonalizedSocialPosts(rows,new Set(["VENUE:mine"])).map(x=>x.id)).toEqual(["visible","public"]);
  });

  it("honors item limits and does not duplicate posts",()=>{
    const rows=Array.from({length:120},(_,i)=>post(String(i),i%2?"other":"mine"));
    const ids=selectPersonalizedSocialPosts(rows,new Set(["VENUE:mine"]),20).map(x=>x.id);
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
  });
});
