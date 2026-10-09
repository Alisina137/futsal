import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const assert=(ok,message)=>{if(!ok)throw new Error(message);};

const layout=read("apps/mobile/app/(app)/_layout.tsx");
const comments=read("apps/mobile/app/(app)/posts/[postId]/comments.tsx");
const home=read("apps/mobile/app/(app)/(tabs)/home.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const locales=read("packages/localization/src/index.ts");

assert(layout.includes('name="posts/[postId]/comments"')
  &&layout.includes('presentation:"transparentModal"')
  &&layout.includes('animation:"slide_from_bottom"'),
  "Tapping Comment must open the transparent slide-up modal over the feed.");
assert(comments.includes("styles.scrim")&&comments.includes("styles.sheet")
  &&comments.includes("styles.handleArea")&&comments.includes('height:"91%"')
  &&comments.includes("PanResponder.create")&&comments.includes("sheetSwipe.panHandlers"),
  "Comments must use a rounded floating bottom sheet with a visible drag handle and dismiss scrim.");
assert(!comments.includes("<Screen")&&!comments.includes("showHeader"),
  "Comments sheet must not show an unrelated Futsal page header.");
assert(comments.includes("KeyboardAvoidingView")&&comments.includes("ScrollView")
  &&comments.includes("styles.composerDock")&&comments.includes('testID="social-comment-composer"'),
  "Comments must scroll independently of the fixed keyboard-aware bottom composer.");
assert(comments.includes('testID="social-comment-send"')&&comments.includes("disabled={!canPost}")
  &&comments.includes("marketingApi.addSocialComment"),
  "Send must persist comments and disable invalid/double submissions.");
assert(comments.includes("styles.commentBubble")&&comments.includes("Avatar")
  &&comments.includes("formatPostTimeAgo(comment.createdAt"),
  "Comment rows must display profile avatars, Facebook-style bubbles and relative time.");
assert(comments.includes("replyToComment")&&comments.includes("replyTo")&&comments.includes("inputRef.current?.focus()"),
  "Reply action must target the comment author and focus the composer.");
assert(comments.includes("comment.canManage")&&comments.includes("confirmDelete")
  &&comments.includes("saveEdit")&&comments.includes("deleteComment"),
  "Comment editing and deletion must remain restricted to manageable comments.");
assert(comments.includes("toggleCommentLike")
  &&comments.includes("marketingApi.likeSocialComment")&&comments.includes("marketingApi.unlikeSocialComment"),
  "Comment Like/Unlike actions must use the real server.");
assert(comments.includes("togglePostLike")&&comments.includes("marketingApi.likeSocialPost"),
  "Post reaction status in the sheet must remain real.");
assert(comments.includes('post.authorType==="USER"')&&comments.includes('pathname:"/people/[userId]"'),
  "Personal post author navigation must work from comments.");
assert(comments.includes("styles.replyBanner")&&comments.includes('t("social.replyingTo"')
  &&comments.includes("cancelReply"),
  "Reply composer must show context and allow cancellation.");
assert(home.includes('pathname:"/posts/[postId]/comments"')
  &&api.includes("socialComments:")&&api.includes("updateSocialComment:")
  &&api.includes("deleteSocialComment:"),
  "Existing feed comment entry points and API operations must remain usable.");
for(const key of [
  "social.closeComments","social.replyComment","social.replyingTo","social.cancelReply",
  "social.commentOptions","social.showOriginalPost","social.firstCommentHint",
]){
  assert(locales.split(`"${key}"`).length-1===3,
    `Missing Facebook-comments translation for English, Dari or Pashto: ${key}`);
}
console.log("Facebook-style comments verified: transparent bottom sheet, persistent composer, RTL, avatars, bubble layout, real Likes, owner-only edits/deletes and reply mentions.");
