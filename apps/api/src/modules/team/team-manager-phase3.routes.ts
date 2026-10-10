import { Router,type Request,type Response,type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { and,desc,eq,inArray,or } from "drizzle-orm";
import type { Database } from "@leaguekick/database";
import {
  competitions,competitionMatches,competitionTeams,playerMatchStats,playerProfiles,roleSubscriptions,
  socialPosts,socialUserPostImages,teamAnnouncements,teamFriendlyChallenges,
  teamMemberships,teams,
} from "@leaguekick/database";
import { errors } from "../../lib/errors.js";
import {teamLicenseActive,requireTeamLicense} from "./team-slots.js";
import { requireAuth } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";
import type { NotificationPublisher } from "../notifications/notification.types.js";

const uuid=z.string().uuid();
const postInput=z.object({body:z.string().trim().max(2000),imageUrl:z.string().max(300).nullable()})
  .refine(x=>!!x.body||!!x.imageUrl,{message:"Add text or an image."});
const announcementInput=z.object({title:z.string().trim().min(2).max(120),body:z.string().trim().min(2).max(2000)});
const challengeInput=z.object({toTeamId:uuid,proposedAt:z.string().datetime({offset:true}),
  venueName:z.string().trim().max(160).nullable(),message:z.string().trim().max(500).nullable()});
const challengeDecision=z.object({decision:z.enum(["ACCEPTED","DECLINED"])});
const safeImage=/^\/api\/v1\/social\/post-images\/([0-9a-f-]{36})\/([A-Za-z0-9_-]{32,64})$/;

export function assertFriendlyChallengeAllowed(fromTeamId:string,toTeamId:string,proposedAt:Date,now:Date){
  if(fromTeamId===toTeamId)throw errors.badRequest("FRIENDLY_SAME_TEAM","Choose another team.");
  if(proposedAt.getTime()<now.getTime()+30*60_000)
    throw errors.badRequest("FRIENDLY_TIME_INVALID","Choose a time at least 30 minutes in the future.");
}
export function aggregateCompletedMatches(games:Array<{homeTeamId:string|null;awayTeamId:string|null;
  homeScore:number|null;awayScore:number|null;status:string;}>,teamId:string){
  const final=games.filter(g=>["COMPLETED","CORRECTED"].includes(g.status)&&g.homeScore!==null&&g.awayScore!==null);
  let wins=0,draws=0,losses=0,goalsFor=0,goalsAgainst=0;
  for(const game of final){
    const our=game.homeTeamId===teamId?game.homeScore!:game.awayScore!;
    const their=game.homeTeamId===teamId?game.awayScore!:game.homeScore!;
    goalsFor+=our;goalsAgainst+=their;
    if(our>their)wins++;else if(our===their)draws++;else losses++;
  }
  return {played:final.length,wins,draws,losses,goalsFor,goalsAgainst,
    goalDifference:goalsFor-goalsAgainst,winRate:final.length?Math.round(wins*100/final.length):0};
}
export class TeamManagerPhase3Service{
  constructor(private readonly db:Database,private readonly now:()=>Date=()=>new Date(),
    private readonly notifications?:NotificationPublisher){}

  private async access(userId:string,teamId:string,mode:"MANAGER"|"WRITE"|"MEMBER"="MANAGER"){
    const [record]=await this.db.select({id:teams.id,name:teams.name,managerUserId:teams.managerUserId,
      status:teams.status,privacy:teams.privacy,offlineVenueId:teams.offlineVenueId,claimedAt:teams.claimedAt})
      .from(teams).where(eq(teams.id,teamId)).limit(1);
    if(!record||record.status!=="ACTIVE"||(record.offlineVenueId&&!record.claimedAt))
      throw errors.badRequest("TEAM_NOT_FOUND","This team is not available.");
    const manager=record.managerUserId===userId;
    if(!manager){
      if(mode!=="MEMBER")throw errors.forbidden("TEAM_MANAGER_REQUIRED","Only the team manager can access this page.");
      const [membership]=await this.db.select({id:teamMemberships.userId}).from(teamMemberships)
        .where(and(eq(teamMemberships.teamId,teamId),eq(teamMemberships.userId,userId),eq(teamMemberships.status,"ACTIVE"))).limit(1);
      if(!membership)throw errors.forbidden("TEAM_MEMBER_REQUIRED","This information is for team members only.");
    }
    if(mode==="WRITE"){
      await requireTeamLicense(this.db,userId,teamId,this.now());
    }
    return record;
  }
  private async announceToMembers(actorId:string,teamId:string,title:string,kind:"announcement"|"challenge",
    recordId:string){
    if(!this.notifications)return;
    try{
      const [team]=await this.db.select({name:teams.name}).from(teams).where(eq(teams.id,teamId)).limit(1);
      const members=await this.db.select({userId:teamMemberships.userId}).from(teamMemberships)
        .where(and(eq(teamMemberships.teamId,teamId),eq(teamMemberships.status,"ACTIVE")));
      const userIds=members.map(v=>v.userId).filter(id=>id!==actorId);
      if(kind==="announcement")await this.notifications.teamAnnouncement({
        teamId,announcementId:recordId,teamName:team?.name??"Team",title,userIds,
      });
    }catch{/* Notifications never invalidate a committed announcement. */}
  }
  private async notifyChallenge(teamId:string,challengeId:string,actorId:string,title:string){
    if(!this.notifications)return;
    try{
      const [team]=await this.db.select({managerUserId:teams.managerUserId,name:teams.name})
        .from(teams).where(eq(teams.id,teamId)).limit(1);
      if(team&&team.managerUserId!==actorId)await this.notifications.teamChallenge({
        teamId,challengeId,teamName:team.name,title,userIds:[team.managerUserId],
      });
    }catch{/* Delivery is best-effort. */}
  }
  private async ownedImage(userId:string,imageUrl:string|null){
    if(!imageUrl)return;
    const match=safeImage.exec(imageUrl);
    if(!match)throw errors.badRequest("POST_IMAGE_INVALID","Choose a photo uploaded through the app.");
    const [image]=await this.db.select({id:socialUserPostImages.id}).from(socialUserPostImages)
      .where(and(eq(socialUserPostImages.id,match[1]!),eq(socialUserPostImages.publicToken,match[2]!),
        eq(socialUserPostImages.ownerUserId,userId))).limit(1);
    if(!image)throw errors.forbidden("POST_IMAGE_NOT_OWNED","The photo was uploaded by another account.");
  }
  private async postRecord(teamId:string,postId:string){
    const [post]=await this.db.select({id:socialPosts.id}).from(socialPosts)
      .where(and(eq(socialPosts.id,postId),eq(socialPosts.entityType,"TEAM"),eq(socialPosts.entityId,teamId),
        eq(socialPosts.status,"PUBLISHED"))).limit(1);
    if(!post)throw errors.badRequest("TEAM_POST_NOT_FOUND","The team post was not found.");
    return post;
  }
  async workspace(userId:string,teamId:string){
    await this.access(userId,teamId);
    const [posts,announcements,challenges,matches,playerStats,competitionsHistory]=await Promise.all([
      this.db.select({id:socialPosts.id,body:socialPosts.body,imageUrl:socialPosts.imageUrl,
        publishedAt:socialPosts.publishedAt}).from(socialPosts)
        .where(and(eq(socialPosts.entityType,"TEAM"),eq(socialPosts.entityId,teamId),eq(socialPosts.status,"PUBLISHED")))
        .orderBy(desc(socialPosts.publishedAt)).limit(60),
      this.db.select().from(teamAnnouncements).where(eq(teamAnnouncements.teamId,teamId))
        .orderBy(desc(teamAnnouncements.createdAt)).limit(60),
      this.db.select().from(teamFriendlyChallenges)
        .where(or(eq(teamFriendlyChallenges.fromTeamId,teamId),eq(teamFriendlyChallenges.toTeamId,teamId)))
        .orderBy(desc(teamFriendlyChallenges.createdAt)).limit(75),
      this.db.select({competitionId:competitionMatches.competitionId,homeTeamId:competitionMatches.homeTeamId,
        awayTeamId:competitionMatches.awayTeamId,status:competitionMatches.status,
        homeScore:competitionMatches.homeScore,awayScore:competitionMatches.awayScore,
        stage:competitionMatches.stage,roundNumber:competitionMatches.roundNumber,winnerTeamId:competitionMatches.winnerTeamId})
        .from(competitionMatches).where(or(eq(competitionMatches.homeTeamId,teamId),eq(competitionMatches.awayTeamId,teamId))),
      this.db.select({userId:playerMatchStats.playerUserId,goals:playerMatchStats.goals,
        assists:playerMatchStats.assists,yellowCards:playerMatchStats.yellowCards,
        redCards:playerMatchStats.redCards,appeared:playerMatchStats.appeared,
        cleanSheet:playerMatchStats.cleanSheet,playerOfMatch:playerMatchStats.playerOfMatch,
        matchStatus:competitionMatches.status,displayName:playerProfiles.publicDisplayName})
        .from(playerMatchStats).innerJoin(competitionMatches,eq(playerMatchStats.matchId,competitionMatches.id))
        .leftJoin(playerProfiles,eq(playerMatchStats.playerUserId,playerProfiles.userId))
        .where(eq(playerMatchStats.teamId,teamId)),
      this.db.select({id:competitions.id,name:competitions.name,status:competitions.status,
        format:competitions.format,rewards:competitions.rewards,registrationStatus:competitionTeams.status})
        .from(competitionTeams).innerJoin(competitions,eq(competitionTeams.competitionId,competitions.id))
        .where(eq(competitionTeams.teamId,teamId)).orderBy(desc(competitions.createdAt)),
    ]);
    const opponentIds=[...new Set(challenges.flatMap(c=>[c.fromTeamId,c.toTeamId]).filter(id=>id!==teamId))];
    const opponents=opponentIds.length?await this.db.select({id:teams.id,name:teams.name}).from(teams)
      .where(inArray(teams.id,opponentIds)):[];
    const byId=new Map(opponents.map(x=>[x.id,x.name]));
    const players=new Map<string,{userId:string;displayName:string;matches:number;goals:number;assists:number;
      yellowCards:number;redCards:number;cleanSheets:number;playerOfMatch:number}>();
    for(const p of playerStats){
      if(!["COMPLETED","CORRECTED"].includes(p.matchStatus))continue;
      const entry=players.get(p.userId)??{userId:p.userId,displayName:p.displayName??"Player",
        matches:0,goals:0,assists:0,yellowCards:0,redCards:0,cleanSheets:0,playerOfMatch:0};
      entry.matches+=p.appeared?1:0;entry.goals+=p.goals;entry.assists+=p.assists;
      entry.yellowCards+=p.yellowCards;entry.redCards+=p.redCards;
      entry.cleanSheets+=p.cleanSheet?1:0;entry.playerOfMatch+=p.playerOfMatch?1:0;
      players.set(p.userId,entry);
    }
    const titles=competitionsHistory.map(c=>{
      const knockout=matches.filter(m=>m.competitionId===c.id&&m.stage==="KNOCKOUT");
      const lastRound=knockout.length?Math.max(...knockout.map(m=>m.roundNumber)):null;
      const finals=lastRound===null?[]:knockout.filter(m=>m.roundNumber===lastRound);
      const champion=!!(c.status==="COMPLETED"&&finals.length===1&&
        ["COMPLETED","CORRECTED"].includes(finals[0]!.status)&&finals[0]?.winnerTeamId===teamId);
      return {...c,champion};
    });
    return {
      posts:posts.map(p=>({...p,publishedAt:p.publishedAt.toISOString()})),
      announcements:announcements.map(a=>({...a,createdAt:a.createdAt.toISOString(),updatedAt:a.updatedAt.toISOString()})),
      challenges:challenges.map(c=>({...c,opponentName:byId.get(c.fromTeamId===teamId?c.toTeamId:c.fromTeamId)??"",
        proposedAt:c.proposedAt.toISOString(),respondedAt:c.respondedAt?.toISOString()??null,
        createdAt:c.createdAt.toISOString()})),
      stats:{...aggregateCompletedMatches(matches,teamId),
        players:[...players.values()].sort((a,b)=>b.goals-a.goals||b.assists-a.assists),
        competitionHistory:titles,championships:titles.filter(x=>x.champion).length},
    };
  }
  async createPost(userId:string,teamId:string,input:z.infer<typeof postInput>){
    await this.access(userId,teamId,"WRITE");await this.ownedImage(userId,input.imageUrl);
    const [post]=await this.db.insert(socialPosts).values({
      entityType:"TEAM",entityId:teamId,createdByUserId:userId,body:input.body,
      imageUrl:input.imageUrl,visibility:"PUBLIC",status:"PUBLISHED",postType:"GENERAL",
      publishedAt:this.now(),createdAt:this.now(),updatedAt:this.now(),
    }).returning({id:socialPosts.id});
    return {id:post!.id};
  }
  async updatePost(userId:string,teamId:string,postId:string,input:z.infer<typeof postInput>){
    await this.access(userId,teamId,"WRITE");await this.postRecord(teamId,postId);
    await this.ownedImage(userId,input.imageUrl);
    await this.db.update(socialPosts).set({body:input.body,imageUrl:input.imageUrl,updatedAt:this.now()})
      .where(and(eq(socialPosts.id,postId),eq(socialPosts.entityType,"TEAM"),eq(socialPosts.entityId,teamId)));
    return {updated:true};
  }
  async deletePost(userId:string,teamId:string,postId:string){
    await this.access(userId,teamId,"WRITE");await this.postRecord(teamId,postId);
    await this.db.update(socialPosts).set({status:"UNPUBLISHED",unpublishedAt:this.now(),updatedAt:this.now()})
      .where(and(eq(socialPosts.id,postId),eq(socialPosts.entityType,"TEAM"),eq(socialPosts.entityId,teamId)));
    return {deleted:true};
  }
  async memberAnnouncements(userId:string,teamId:string){
    await this.access(userId,teamId,"MEMBER");
    const list=await this.db.select().from(teamAnnouncements).where(eq(teamAnnouncements.teamId,teamId))
      .orderBy(desc(teamAnnouncements.createdAt)).limit(70);
    return {announcements:list.map(a=>({...a,createdAt:a.createdAt.toISOString(),updatedAt:a.updatedAt.toISOString()}))};
  }
  async createAnnouncement(userId:string,teamId:string,input:z.infer<typeof announcementInput>){
    await this.access(userId,teamId,"WRITE");
    const [row]=await this.db.insert(teamAnnouncements).values({teamId,authorId:userId,...input})
      .returning({id:teamAnnouncements.id});
    await this.announceToMembers(userId,teamId,input.title,"announcement",row!.id);
    return {id:row!.id};
  }
  async deleteAnnouncement(userId:string,teamId:string,id:string){
    await this.access(userId,teamId,"WRITE");
    const [row]=await this.db.delete(teamAnnouncements)
      .where(and(eq(teamAnnouncements.id,id),eq(teamAnnouncements.teamId,teamId)))
      .returning({id:teamAnnouncements.id});
    if(!row)throw errors.badRequest("ANNOUNCEMENT_NOT_FOUND","Announcement not found.");
    return {deleted:true};
  }
  async createChallenge(userId:string,teamId:string,input:z.infer<typeof challengeInput>){
    await this.access(userId,teamId,"WRITE");
    assertFriendlyChallengeAllowed(teamId,input.toTeamId,new Date(input.proposedAt),this.now());
    const [other]=await this.db.select({id:teams.id,status:teams.status,offlineVenueId:teams.offlineVenueId,
      claimedAt:teams.claimedAt}).from(teams).where(eq(teams.id,input.toTeamId)).limit(1);
    if(!other||other.status!=="ACTIVE"||(other.offlineVenueId&&!other.claimedAt))
      throw errors.badRequest("CHALLENGE_TEAM_NOT_FOUND","Choose a registered active opponent.");
    const pending=await this.db.select({id:teamFriendlyChallenges.id}).from(teamFriendlyChallenges)
      .where(and(eq(teamFriendlyChallenges.fromTeamId,teamId),eq(teamFriendlyChallenges.toTeamId,input.toTeamId),
        eq(teamFriendlyChallenges.status,"PENDING"))).limit(1);
    if(pending.length)throw errors.conflict("CHALLENGE_ALREADY_PENDING","A challenge to this team is already pending.");
    const [created]=await this.db.insert(teamFriendlyChallenges).values({
      fromTeamId:teamId,toTeamId:input.toTeamId,proposedAt:new Date(input.proposedAt),
      venueName:input.venueName,message:input.message,
    }).returning({id:teamFriendlyChallenges.id});
    await this.notifyChallenge(input.toTeamId,created!.id,userId,"New friendly match challenge");
    return {id:created!.id};
  }
  async answerChallenge(userId:string,teamId:string,id:string,decision:"ACCEPTED"|"DECLINED"){
    await this.access(userId,teamId,"WRITE");
    const [item]=await this.db.select().from(teamFriendlyChallenges)
      .where(and(eq(teamFriendlyChallenges.id,id),eq(teamFriendlyChallenges.toTeamId,teamId))).limit(1);
    if(!item||item.status!=="PENDING"||item.proposedAt<=this.now())
      throw errors.conflict("CHALLENGE_UNAVAILABLE","Challenge is expired or already decided.");
    const [updated]=await this.db.update(teamFriendlyChallenges).set({status:decision,respondedAt:this.now()})
      .where(and(eq(teamFriendlyChallenges.id,id),eq(teamFriendlyChallenges.toTeamId,teamId),
        eq(teamFriendlyChallenges.status,"PENDING"))).returning({id:teamFriendlyChallenges.id});
    if(!updated)throw errors.conflict("CHALLENGE_UNAVAILABLE","Challenge already handled.");
    await this.notifyChallenge(item.fromTeamId,id,userId,decision==="ACCEPTED"?
      "Friendly match challenge accepted":"Friendly match challenge declined");
    return {status:decision};
  }
  async cancelChallenge(userId:string,teamId:string,id:string){
    await this.access(userId,teamId,"WRITE");
    const [item]=await this.db.update(teamFriendlyChallenges)
      .set({status:"CANCELLED",respondedAt:this.now()})
      .where(and(eq(teamFriendlyChallenges.id,id),eq(teamFriendlyChallenges.fromTeamId,teamId),
        inArray(teamFriendlyChallenges.status,["PENDING","ACCEPTED"])))
      .returning({id:teamFriendlyChallenges.id,toTeamId:teamFriendlyChallenges.toTeamId});
    if(!item)throw errors.conflict("CHALLENGE_UNAVAILABLE","This challenge cannot be cancelled.");
    await this.notifyChallenge(item.toTeamId,id,userId,"Friendly match challenge cancelled");
    return {status:"CANCELLED"};
  }
}
export function createTeamManagerPhase3Router(service:TeamManagerPhase3Service,tokens:TokenService){
  const router=Router(),auth=requireAuth(tokens);
  const limit=rateLimit({windowMs:60_000,limit:35,standardHeaders:"draft-8",legacyHeaders:false});
  const respond=(fn:(userId:string,teamId:string,req:Request)=>Promise<unknown>,status=200)=>
    async(req:Request,res:Response,next:NextFunction)=>{
      try{res.status(status).json(await fn(req.auth!.userId,uuid.parse(req.params.teamId),req));}
      catch(error){next(error);}
    };
  router.get("/teams/:teamId/manager/growth",auth,respond((u,t)=>service.workspace(u,t)));
  router.post("/teams/:teamId/manager/posts",auth,limit,respond((u,t,r)=>service.createPost(u,t,postInput.parse(r.body)),201));
  router.put("/teams/:teamId/manager/posts/:id",auth,limit,
    respond((u,t,r)=>service.updatePost(u,t,uuid.parse(r.params.id),postInput.parse(r.body))));
  router.delete("/teams/:teamId/manager/posts/:id",auth,limit,
    respond((u,t,r)=>service.deletePost(u,t,uuid.parse(r.params.id))));
  router.get("/teams/:teamId/announcements",auth,respond((u,t)=>service.memberAnnouncements(u,t)));
  router.post("/teams/:teamId/manager/announcements",auth,limit,
    respond((u,t,r)=>service.createAnnouncement(u,t,announcementInput.parse(r.body)),201));
  router.delete("/teams/:teamId/manager/announcements/:id",auth,limit,
    respond((u,t,r)=>service.deleteAnnouncement(u,t,uuid.parse(r.params.id))));
  router.post("/teams/:teamId/manager/challenges",auth,limit,
    respond((u,t,r)=>service.createChallenge(u,t,challengeInput.parse(r.body)),201));
  router.post("/teams/:teamId/manager/challenges/:id/decision",auth,limit,
    respond((u,t,r)=>service.answerChallenge(u,t,uuid.parse(r.params.id),challengeDecision.parse(r.body).decision)));
  router.post("/teams/:teamId/manager/challenges/:id/cancel",auth,limit,
    respond((u,t,r)=>service.cancelChallenge(u,t,uuid.parse(r.params.id))));
  return router;
}
