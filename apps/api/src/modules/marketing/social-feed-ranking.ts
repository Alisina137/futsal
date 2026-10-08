/**
 * Followed public/followers posts are primary; recommended posts must be
 * PUBLIC and from other pages only. Both queues already arrive newest-first.
 * This pure selection function keeps all access rules explicit and testable.
 */
export type SocialFeedCandidate={
  entityType:string;
  entityId:string;
  visibility:string;
};

export function selectPersonalizedSocialPosts<T extends SocialFeedCandidate>(
  candidates:ReadonlyArray<T>,
  followed:ReadonlySet<string>,
  limit=100,
):T[]{
  const followedPosts:T[]=[];
  const recommendedPosts:T[]=[];
  for(const post of candidates){
    const isFollowed=followed.has(`${post.entityType}:${post.entityId}`);
    if(isFollowed && (post.visibility==="PUBLIC"||post.visibility==="FOLLOWERS")){
      followedPosts.push(post);
    }else if(!isFollowed && post.visibility==="PUBLIC"){
      recommendedPosts.push(post);
    }
  }
  const result:T[]=[];
  let followIndex=0;
  let recommendIndex=0;
  while(result.length<limit&&(followIndex<followedPosts.length||recommendIndex<recommendedPosts.length)){
    // Three followed posts before each discovery post, if available.
    for(let n=0;n<3&&result.length<limit&&followIndex<followedPosts.length;n++){
      result.push(followedPosts[followIndex++]!);
    }
    if(result.length<limit&&recommendIndex<recommendedPosts.length){
      result.push(recommendedPosts[recommendIndex++]!);
    }
  }
  return result;
}
