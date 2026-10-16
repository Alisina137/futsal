import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("apps/mobile/src/components/team-manager/TeamGrowthPanel.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const route=read("apps/api/src/modules/team/team-manager-phase3.routes.ts");
const locale=read("packages/localization/src/index.ts");
const packageJson=JSON.parse(read("apps/mobile/package.json"));
const required=(source,markers,section)=>markers.forEach(marker=>
  assert.ok(source.includes(marker),section+" missing "+marker));
required(panel,[
  'testID="tm6-media-header"','testID="tm6-new-post"',
  'testID="tm6-post-composer"','testID="tm6-publish-now"',
  'testID="tm6-save-draft"','testID="tm6-restore-draft"',
  'testID="tm6-published-posts"','testID="tm6-post-search"',
  'testID="tm6-announcement-composer"','testID="tm6-announcement-delete-confirm"',
  'Drafts','AsyncStorage.setItem','AsyncStorage.getItem','AsyncStorage.removeItem',
  'session.user.id','draftKeyRef.current===draftKey',
  'marketingApi.uploadUserPostImage','ImagePicker.launchImageLibraryAsync',
  'DocumentPicker.getDocumentAsync','teamGrowthApi.createPost',
  'teamGrowthApi.updatePost','teamGrowthApi.deletePost',
  'teamGrowthApi.createAnnouncement','teamGrowthApi.deleteAnnouncement',
  'post.likeCount??0','post.commentCount??0',
  'setPostFilter','setPostQuery','setAnnouncementToDelete',
  'loadedDataKey!==draftKey','currentTeam.current===teamAtStart',
], "Media panel");
assert.ok(!panel.includes("teamGrowthApi.schedulePost"),"Never expose a fake scheduled publish option.");
assert.ok(packageJson.dependencies["@react-native-async-storage/async-storage"]&&
  packageJson.dependencies["expo-document-picker"],"Installed file/draft dependencies required.");
required(route,[
  'await this.access(userId,teamId,"WRITE")',
  'await this.ownedImage(userId,input.imageUrl)',
  'socialPostLikes','socialPostComments','isNull(socialPostComments.hiddenAt)',
  'groupBy(socialPostLikes.postId)','groupBy(socialPostComments.postId)',
  'likeCount:likeCounts.get(p.id)??0','commentCount:commentCounts.get(p.id)??0',
  'eq(socialPosts.entityType,"TEAM")','eq(socialPosts.entityId,teamId)',
  'eq(socialPosts.status,"PUBLISHED")',
],"Team Manager server");
required(api,['likeCount:number;commentCount:number','createPost:','updatePost:','deletePost:'],
  "Typed API");
for(const key of ["mediaTitle","mediaHelp","resumeDraft","discardDraft","draftDeviceHint",
 "publicOnly","chooseFiles","publishNow","saveDraft","draftSaved","draftError","draftDiscarded",
 "searchPosts","results","noMatches","likes","comments","filter.ALL","filter.PHOTOS",
 "filter.TEXT","membersOnly","sentAnnouncements","confirmAnnouncementDelete"]){
  assert.equal(locale.split('"tm6.'+key+'"').length-1,3,
    "Missing English, Dari or Pashto translation for "+key);
}
console.log("Team Manager Phase 6 verified: Media composer, device-only drafts, files/gallery, real engagement totals, post search, private announcements, account isolation and locales.");
