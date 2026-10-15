import type {PromotionDto,VenuePostDto} from "@leaguekick/contracts";

export const ownerPromotionViews=["ALL","ACTIVE","UPCOMING","EXPIRED","CLOSED"] as const;
export type OwnerPromotionView=(typeof ownerPromotionViews)[number];
export type OwnerPromotionState="ACTIVE"|"UPCOMING"|"EXPIRED"|"CLOSED";

/** A promotion can be stored as ACTIVE before its time slot begins.
 * Only the server changes its status: UPCOMING is strictly a display view. */
export function ownerPromotionState(item:PromotionDto,nowMs:number):OwnerPromotionState{
  if(item.status==="CLOSED")return "CLOSED";
  if(item.status==="EXPIRED"||Date.parse(item.endsAt)<=nowMs)return "EXPIRED";
  if(Date.parse(item.startsAt)>nowMs)return "UPCOMING";
  return "ACTIVE";
}
export function ownerPromotionsForView(
  items:readonly PromotionDto[],view:OwnerPromotionView,nowMs:number,
  query="",
):PromotionDto[]{
  const text=query.trim().toLocaleLowerCase();
  return items.filter(item=>(view==="ALL"||ownerPromotionState(item,nowMs)===view)
      &&(!text||[item.title,item.areaName,item.note??""].some(value=>
        value.toLocaleLowerCase().includes(text))))
    .sort((a,b)=>{
      const as=Date.parse(a.startsAt),bs=Date.parse(b.startsAt);
      return (view==="UPCOMING"?as-bs:bs-as)||a.id.localeCompare(b.id);
    });
}
export function ownerPromotionCounts(items:readonly PromotionDto[],nowMs:number){
  const byState={ALL:items.length,ACTIVE:0,UPCOMING:0,EXPIRED:0,CLOSED:0};
  for(const item of items)byState[ownerPromotionState(item,nowMs)]++;
  return byState;
}
export const ownerPostViews=["ALL","PUBLISHED","DRAFT","SCHEDULED","PRIVATE"] as const;
export type OwnerPostView=(typeof ownerPostViews)[number];
export function ownerHasPendingSchedule(post:VenuePostDto):boolean{
  return post.schedules.some(item=>!item.executedAt&&!item.cancelledAt);
}
export function ownerPostsForView(
  posts:readonly VenuePostDto[],view:OwnerPostView,query="",
):VenuePostDto[]{
  const text=query.trim().toLocaleLowerCase();
  return posts.filter(post=>{
    const fits=view==="ALL"||
      (view==="PUBLISHED"&&post.status==="PUBLISHED"&&post.visibility!=="PRIVATE")||
      (view==="DRAFT"&&post.status==="UNPUBLISHED"&&!ownerHasPendingSchedule(post))||
      (view==="SCHEDULED"&&ownerHasPendingSchedule(post))||
      (view==="PRIVATE"&&post.visibility==="PRIVATE");
    return fits&&(!text||post.body.toLocaleLowerCase().includes(text));
  });
}
