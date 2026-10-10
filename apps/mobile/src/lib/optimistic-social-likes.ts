import type {SocialFeedPostDto} from "@leaguekick/contracts";

export type LikeSnapshot=Pick<SocialFeedPostDto,"likedByMe"|"likeCount">;
type Pending={confirmed:LikeSnapshot;desired:boolean;processing:boolean};
type Mutation=(postId:string,liked:boolean)=>Promise<LikeSnapshot>;
type OnUpdate=(postId:string,snapshot:LikeSnapshot)=>void;
type OnFailure=(postId:string)=>void;

/**
 * One sequential queue per post. Every tap changes the displayed state immediately.
 * If a user taps again before the first request finishes, the last intent wins:
 * an in-flight request completes before the necessary follow-up request is sent.
 */
export class OptimisticSocialLikes {
  private operations=new Map<string,Pending>();
  private recent=new Map<string,{version:number;snapshot:LikeSnapshot}>();
  private revision=0;

  constructor(
    private readonly mutate:Mutation,
    private readonly update:OnUpdate,
    private readonly failed:OnFailure,
  ){}

  /** Capture before starting a feed request, to reject stale responses after a like. */
  get version(){return this.revision;}

  /** Merge results with pending likes and mutations newer than the feed request. */
  mergeFeed(items:SocialFeedPostDto[],startedAtVersion:number):SocialFeedPostDto[]{
    return items.map(post=>{
      const pending=this.operations.get(post.id);
      if(pending)return {...post,...this.present(pending)};
      const recent=this.recent.get(post.id);
      if(recent&&recent.version>startedAtVersion)return {...post,...recent.snapshot};
      return post;
    });
  }

  toggle(post:SocialFeedPostDto):void{
    let operation=this.operations.get(post.id);
    if(!operation){
      operation={
        confirmed:{likedByMe:post.likedByMe,likeCount:post.likeCount},
        desired:post.likedByMe,processing:false,
      };
      this.operations.set(post.id,operation);
    }
    operation.desired=!operation.desired;
    this.emit(post.id,operation);
    if(!operation.processing)void this.flush(post.id,operation);
  }

  private present(operation:Pending):LikeSnapshot{
    const delta=Number(operation.desired)-Number(operation.confirmed.likedByMe);
    return {
      likedByMe:operation.desired,
      likeCount:Math.max(0,operation.confirmed.likeCount+delta),
    };
  }

  private emit(postId:string,operation:Pending):void{
    const snapshot=this.present(operation);
    this.revision+=1;
    this.recent.set(postId,{version:this.revision,snapshot});
    // Bound memory for long-scrolling feeds. Active requests are kept separately.
    if(this.recent.size>300){
      const oldest=this.recent.keys().next().value;
      if(oldest)this.recent.delete(oldest);
    }
    this.update(postId,snapshot);
  }

  private async flush(postId:string,operation:Pending):Promise<void>{
    operation.processing=true;
    try{
      while(operation.confirmed.likedByMe!==operation.desired){
        const requested=operation.desired;
        try{
          // API response is authoritative for count, including likes from others.
          operation.confirmed=await this.mutate(postId,requested);
          this.emit(postId,operation); // Retain the latest tap if a request was in flight.
        }catch{
          // Network/authorization error: undo the optimistic state and show feedback.
          operation.desired=operation.confirmed.likedByMe;
          this.emit(postId,operation);
          this.failed(postId);
          break;
        }
      }
    }finally{
      operation.processing=false;
      if(this.operations.get(postId)===operation)this.operations.delete(postId);
    }
  }
}
