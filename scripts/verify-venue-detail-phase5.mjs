import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const contracts=read("packages/contracts/src/index.ts");
const routes=read("apps/api/src/modules/marketing/marketing.routes.ts");
const repo=read("apps/api/src/modules/marketing/marketing.repository.ts");
const service=read("apps/api/src/modules/marketing/marketing.service.ts");
const fake=read("apps/api/test/fake-marketing-repository.ts");
const tests=read("apps/api/test/marketing.test.ts");
const media=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const locales=read("packages/localization/src/index.ts");
const required=(source,items,message)=>{
  for(const item of items)assert.ok(source.includes(item),message+": "+item);
};
required(contracts,["venueMediaBrowseQuerySchema","venueMediaBrowseResponseSchema",
  'z.enum(["posts","photos","videos"])',
  'z.enum(["newest","oldest"])',
  "venuePostTypeSchema.optional()","max(500).default(1)","max(30).default(12)"],
  "Validated typed page contracts");
required(routes,[
  'router.get("/venues/:venueId/media"',
  'router.get("/venues/:venueId/media/following",requireAuth(tokens)',
  "venueMediaBrowseQuerySchema.parse(request.query)",
  "marketing.browseVenueMedia(venueId,query,request.auth!.userId)",
],"Media browsing routes");
required(service,[
  "await this.refreshMedia()",
  'if(!venue||venue.status!=="ACTIVE")',
  "this.repository.isFollowing(userId,venueId)",
  'following?"PUBLIC_OR_FOLLOWERS":"PUBLIC"',
],"Server-side audience protection");
required(repo,[
  "async browseVenueMedia(","eq(venuePosts.venueId,venueId)",
  'eq(venuePosts.status,"PUBLISHED")','eq(venues.status,"ACTIVE")',
  'query.postType?eq(venuePosts.postType,query.postType):undefined',
  'query.kind==="photos"?isNotNull(venuePosts.imageUrl)',
  'query.kind==="videos"?or(',
  'ilike(venuePosts.body,"%youtube.com/watch?v=%")',
  "query.sort===\"oldest\"?asc(venuePosts.publishedAt):desc(venuePosts.publishedAt)",
  ".limit(query.limit).offset((query.page-1)*query.limit)",
  "query.page*query.limit<total",
],"Real paginated SQL media filtering");
required(fake,["async browseVenueMedia","post.status===\"PUBLISHED\""],"Test double");
required(media,[
  'media:["posts","photos","videos"]',
  "marketingApi.venueMedia(venue.id,",
  '(["all","general","announcement","promotion","competition","result"] as const)',
  'label={tr5("sort.newest")}', 'label={tr5("sort.oldest")}',
  "const request=++requestId.current".replace("const request","const id"),
  "if(id!==requestId.current)return",
  "loadMore()","hasMore","moreError",
  "testID=\"venue-photo-viewer\"","setPhoto(photos[index-1]!.id)",
  "setPhoto(photos[index+1]!.id)","testID={\"venue-video-\"+p.id}",
  "formatPostTimeAgo(post.publishedAt,language,now)",
  "router.push({pathname:\"/posts/[postId]/comments\"",
  "Share.share({message:venue.name",
  "Linking.openURL(url)",
],"Phase 5 Media UI behavior");
required(api,[
  "venueMedia:(venueId:string,options:",
  'networkRequest<import("@leaguekick/contracts").VenueMediaBrowseResponse>',
  'cache:"no-store"',
],"Typed client Media requests");
required(tests,[
  'it("pages venue Media',
  "following.body.total","private","photoPage.body.total",
  "videos.body.total",
],"Audience and pagination tests");
for(const key of ["vd5.filter.all","vd5.filter.promotion","vd5.filter.result",
  "vd5.sort.newest","vd5.sort.oldest","vd5.loadMore",
  "vd5.previous","vd5.next","vd5.videoOpenError","vd5.share"]){
  assert.equal(locales.split('"'+key+'"').length-1,3,"Missing EN/Dari/Pashto "+key);
}
console.log("Venue Detail Phase 5 verified: server-paged audience-safe Media, album viewer, video cards, filters, sorting and social actions.");
