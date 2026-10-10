import type {SocialFeedPostDto} from "@leaguekick/contracts";
import {describe,expect,it,vi} from "vitest";
import {OptimisticSocialLikes,type LikeSnapshot} from "../../mobile/src/lib/optimistic-social-likes.js";

const post=(likedByMe=false,likeCount=3):SocialFeedPostDto=>({
  id:"11111111-1111-4111-8111-111111111111",
  authorType:"USER",authorId:"22222222-2222-4222-8222-222222222222",
  authorName:"Player",authorImageUrl:null,body:"Futsal match",imageUrl:null,
  postType:"GENERAL",publishedAt:"2026-10-10T00:00:00.000Z",deepLink:"/posts/test",
  likedByMe,likeCount,commentCount:1,
});
function deferred<T>(){
  let resolve!:(value:T)=>void;
  let reject!:(error:Error)=>void;
  const promise=new Promise<T>((res,rej)=>{resolve=res;reject=rej;});
  return {promise,resolve,reject};
}
async function settle(){
  for(let i=0;i<6;i++)await Promise.resolve();
}
describe("optimistic Home post likes",()=>{
  it("immediately changes like icon state AND count, before a delayed API response",async()=>{
    const call=deferred<LikeSnapshot>();
    const updates:LikeSnapshot[]=[];
    const failed=vi.fn();
    const mutate=vi.fn(()=>call.promise);
    const queue=new OptimisticSocialLikes(mutate,(_id,s)=>updates.push(s),failed);
    const initial=post();
    const started=queue.version;
    queue.toggle(initial);
    expect(updates[0]).toEqual({likedByMe:true,likeCount:4});
    expect(mutate).toHaveBeenCalledWith(initial.id,true);
    expect(queue.mergeFeed([initial],started)[0]).toMatchObject({likedByMe:true,likeCount:4});
    call.resolve({likedByMe:true,likeCount:6}); // other likes occurred simultaneously
    await settle();
    expect(updates.at(-1)).toEqual({likedByMe:true,likeCount:6});
    expect(failed).not.toHaveBeenCalled();
  });

  it("coalesces quick like/unlike taps without sending overlapping writes",async()=>{
    const like=deferred<LikeSnapshot>(),unlike=deferred<LikeSnapshot>();
    const mutate=vi.fn((_id:string,liked:boolean)=>liked?like.promise:unlike.promise);
    const updates:LikeSnapshot[]=[];
    const queue=new OptimisticSocialLikes(mutate,(_id,s)=>updates.push(s),vi.fn());
    const initial=post();
    queue.toggle(initial);
    queue.toggle(initial); // stale prop is fine: the queue uses the latest intent
    expect(updates.map(x=>x.likedByMe)).toEqual([true,false]);
    expect(mutate).toHaveBeenCalledTimes(1);
    like.resolve({likedByMe:true,likeCount:4});
    await settle();
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate).toHaveBeenLastCalledWith(initial.id,false);
    expect(updates.at(-1)).toEqual({likedByMe:false,likeCount:3});
    unlike.resolve({likedByMe:false,likeCount:3});
    await settle();
    expect(updates.at(-1)).toEqual({likedByMe:false,likeCount:3});
  });

  it("rolls back a failed optimistic like, shows an error and allows retry",async()=>{
    const failed=vi.fn();
    const changes:LikeSnapshot[]=[];
    const mutate=vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({likedByMe:true,likeCount:4});
    const queue=new OptimisticSocialLikes(mutate,(_id,s)=>changes.push(s),failed);
    const initial=post();
    queue.toggle(initial);
    expect(changes[0]?.likedByMe).toBe(true);
    await settle();
    expect(changes.at(-1)).toEqual({likedByMe:false,likeCount:3});
    expect(failed).toHaveBeenCalledWith(initial.id);
    queue.toggle(initial);
    await settle();
    expect(changes.at(-1)).toEqual({likedByMe:true,likeCount:4});
  });

  it("retains optimistic/confirmed changes against feed refreshes that started before mutation",async()=>{
    const request=deferred<LikeSnapshot>();
    const queue=new OptimisticSocialLikes(()=>request.promise,()=>{},()=>{});
    const initial=post();
    const oldRefreshVersion=queue.version;
    queue.toggle(initial);
    const pending=queue.mergeFeed([post()],oldRefreshVersion)[0];
    expect(pending).toMatchObject({likedByMe:true,likeCount:4});
    request.resolve({likedByMe:true,likeCount:5});
    await settle();
    expect(queue.mergeFeed([post()],oldRefreshVersion)[0]).toMatchObject({likedByMe:true,likeCount:5});
    expect(queue.mergeFeed([post(true,5)],queue.version)[0]).toMatchObject({
      likedByMe:true,likeCount:5,
    });
  });

  it("keeps counts nonnegative on unlike, and preserves independent post state",async()=>{
    const updates=new Map<string,LikeSnapshot>();
    const waiting=deferred<LikeSnapshot>();
    const queue=new OptimisticSocialLikes(()=>waiting.promise,(id,s)=>updates.set(id,s),()=>{});
    const initial=post(true,0);
    queue.toggle(initial);
    expect(updates.get(initial.id)).toEqual({likedByMe:false,likeCount:0});
    const different={...post(),id:"33333333-3333-4333-8333-333333333333"};
    expect(queue.mergeFeed([different],0)[0]).toEqual(different);
    waiting.resolve({likedByMe:false,likeCount:0});
    await settle();
  });
});
