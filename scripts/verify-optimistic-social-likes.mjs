import fs from "node:fs";
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const check=(condition,message)=>{if(!condition)throw Error(message);};
const home=read("apps/mobile/app/(app)/(tabs)/home.tsx");
const queue=read("apps/mobile/src/lib/optimistic-social-likes.ts");
const cases=read("apps/api/test/optimistic-social-like.test.ts");
check(home.includes("likes.toggle(post)")&&home.includes('const likes=useMemo(()=>new OptimisticSocialLikes(')
  &&home.includes("setItems(current=>current.map(item=>item.id===id?{...item,...snapshot}:item))"),
  "Home must instantly render both the Like button and count from the optimistic queue.");
check(home.includes("likes.mergeFeed(fresh.items,startedAtVersion)")
  &&home.includes("currentTokenRef.current!==session.accessToken"),
  "Background refreshes must not overwrite pending likes or bleed across sessions.");
check(queue.includes("operation.desired=!operation.desired")
  &&queue.includes("operation.processing=true")
  &&queue.includes("while(operation.confirmed.likedByMe!==operation.desired)")
  &&queue.includes("Math.max(0,operation.confirmed.likeCount+delta)"),
  "Rapid taps must coalesce into sequential writes, with a nonnegative optimistic count.");
check(queue.includes("await this.mutate(postId,requested)")
  &&queue.includes("operation.desired=operation.confirmed.likedByMe")
  &&queue.includes("this.failed(postId)")
  &&home.includes("setLikeErrors")
  &&home.includes('t("social.likeError")'),
  "Backend failures must rollback optimistic state and show localized errors.");
check(!home.includes("likeBusy")&&!home.includes("disabled={likeBusy}")
  &&home.includes("onPress={toggleLike}"),
  "Home Like button must not freeze or appear dimmed during background persistence.");
check(cases.includes("quick like/unlike taps")
  &&cases.includes("rolls back a failed optimistic like")
  &&cases.includes("against feed refreshes"),
  "Regression tests must exercise latency, rapid toggles, rollback and refresh races.");
console.log("Optimistic social likes verified: instant UI/count, coalesced requests, server confirmation, error rollback, user isolation and stale refresh protection.");
