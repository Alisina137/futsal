import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { Database } from "@leaguekick/database";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import {
  competitionMatches, competitions, competitionTeams, roleSubscriptions,
  socialPosts, teamActivities, teamActivityResponses, teamFriendlyChallenges,
  teamGuestPlayers, teamMatchLineups, teamMemberships, teams, venues, socialUserPostImages,
} from "@leaguekick/database";
import { errors } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";

const uuid = z.string().uuid();
const activityInput=z.object({
  kind:z.enum(["TRAINING","MEETING","FRIENDLY","OTHER"]),
  title:z.string().trim().min(2).max(120),
  description:z.string().trim().max(1000).optional(),
  place:z.string().trim().max(160).optional(),
  startsAt:z.string().datetime({offset:true}),
  endsAt:z.string().datetime({offset:true}),
}).refine(v=>Date.parse(v.endsAt)>Date.parse(v.startsAt),{message:"End time must be after start."});
const guestInput=z.object({
  name:z.string().trim().min(2).max(100),
  position:z.enum(["GOALKEEPER","FIXO","ALA","PIVO","UNIVERSAL","UNSPECIFIED"]).default("UNSPECIFIED"),
  shirtNumber:z.number().int().min(1).max(99).nullable().default(null),
});
const lineupInput=z.object({
  startingUserIds:z.array(uuid).max(5),
  substituteUserIds:z.array(uuid).max(20),
}).refine(v=>new Set([...v.startingUserIds,...v.substituteUserIds]).size===v.startingUserIds.length+v.substituteUserIds.length,{message:"A player can only appear once."});
const challengeInput=z.object({
  toTeamId:uuid,
  proposedAt:z.string().datetime({offset:true}),
  place:z.string().trim().max(160).optional(),
});

type SubscriptionGate={manager:boolean;member:boolean};
export class TeamWorkspaceService {
  constructor(private readonly db:Database,private readonly now:()=>Date=()=>new Date()){}

  private async access(userId:string,teamId:string,write=false):Promise<SubscriptionGate>{
    const [team]=await this.db.select({id:teams.id,managerUserId:teams.managerUserId,
      offlineVenueId:teams.offlineVenueId,claimedAt:teams.claimedAt,status:teams.status})
      .from(teams).where(eq(teams.id,teamId)).limit(1);
    if(!team||team.status!=="ACTIVE"||(team.offlineVenueId&&!team.claimedAt)){
      throw errors.badRequest("TEAM_NOT_FOUND","This team is not available.");
    }
    const manager=team.managerUserId===userId;
    const [membership]=await this.db.select({role:teamMemberships.role})
      .from(teamMemberships).where(and(eq(teamMemberships.teamId,teamId),
        eq(teamMemberships.userId,userId),eq(teamMemberships.status,"ACTIVE"))).limit(1);
    if(!manager&&!membership)throw errors.forbidden("TEAM_WORKSPACE_PRIVATE","You do not belong to this team.");
    if(write){
      if(!manager)throw errors.forbidden("TEAM_MANAGER_REQUIRED","Only this team's manager can manage it.");
      const [sub]=await this.db.select({status:roleSubscriptions.status,activeUntil:roleSubscriptions.activeUntil})
        .from(roleSubscriptions).where(and(eq(roleSubscriptions.userId,userId),eq(roleSubscriptions.role,"TEAM_MANAGER"))).limit(1);
      if(!sub||sub.status!=="ACTIVE"||!sub.activeUntil||sub.activeUntil<=this.now())
        throw errors.forbidden("TEAM_SUBSCRIPTION_EXPIRED","Renew your Team Manager subscription to make changes.");
    }
    return {manager,member:!!membership||manager};
  }

  async list(userId:string,teamId:string){
    const viewer=await this.access(userId,teamId);
    const [registrations,matches,activities,responses,guests,posts,lineups,friendlies]=await Promise.all([
      this.db.select({id:competitions.id,name:competitions.name,venueName:venues.name,
        format:competitions.format,competitionStatus:competitions.status,registrationStatus:competitionTeams.status,
        registrationClosesAt:competitions.registrationClosesAt,startsAt:competitions.startsAt,endsAt:competitions.endsAt})
        .from(competitionTeams).innerJoin(competitions,eq(competitionTeams.competitionId,competitions.id))
        .innerJoin(venues,eq(competitions.venueId,venues.id))
        .where(eq(competitionTeams.teamId,teamId)).orderBy(desc(competitions.createdAt)),
      this.db.select({id:competitionMatches.id,competitionId:competitionMatches.competitionId,
        homeTeamId:competitionMatches.homeTeamId,awayTeamId:competitionMatches.awayTeamId,
        startsAt:competitionMatches.startsAt,status:competitionMatches.status,
        homeScore:competitionMatches.homeScore,awayScore:competitionMatches.awayScore,
        roundNumber:competitionMatches.roundNumber,stage:competitionMatches.stage})
        .from(competitionMatches).where(or(eq(competitionMatches.homeTeamId,teamId),eq(competitionMatches.awayTeamId,teamId))),
      this.db.select().from(teamActivities).where(eq(teamActivities.teamId,teamId)).orderBy(asc(teamActivities.startsAt)),
      this.db.select({activityId:teamActivityResponses.activityId,userId:teamActivityResponses.userId,
        status:teamActivityResponses.status}).from(teamActivityResponses).innerJoin(teamActivities,eq(teamActivities.id,teamActivityResponses.activityId))
        .where(eq(teamActivities.teamId,teamId)),
      this.db.select().from(teamGuestPlayers).where(eq(teamGuestPlayers.teamId,teamId)).orderBy(asc(teamGuestPlayers.name)),
      this.db.select({id:socialPosts.id,body:socialPosts.body,imageUrl:socialPosts.imageUrl,
        publishedAt:socialPosts.publishedAt,createdByUserId:socialPosts.createdByUserId})
        .from(socialPosts).where(and(eq(socialPosts.entityType,"TEAM"),eq(socialPosts.entityId,teamId),eq(socialPosts.status,"PUBLISHED")))
        .orderBy(desc(socialPosts.publishedAt)).limit(60),
      this.db.select().from(teamMatchLineups).where(eq(teamMatchLineups.teamId,teamId)),
      this.db.select().from(teamFriendlyChallenges).where(or(eq(teamFriendlyChallenges.fromTeamId,teamId),eq(teamFriendlyChallenges.toTeamId,teamId)))
        .orderBy(desc(teamFriendlyChallenges.createdAt)).limit(60),
    ]);
    const opponentIds=[...new Set(matches.flatMap(m=>[m.homeTeamId,m.awayTeamId]).concat(friendlies.flatMap(f=>[f.fromTeamId,f.toTeamId])).filter((id):id is string=>!!id&&id!==teamId))];
    const opponents=opponentIds.length?await this.db.select({id:teams.id,name:teams.name})
      .from(teams).where(inArray(teams.id,opponentIds)):[];
    const names=new Map(opponents.map(t=>[t.id,t.name]));
    const competitionsById=new Map(registrations.map(c=>[c.id,c.name]));
    return {viewer,competitions:registrations.map(x=>({...x,registrationClosesAt:x.registrationClosesAt?.toISOString()??null,
      startsAt:x.startsAt?.toISOString()??null,endsAt:x.endsAt?.toISOString()??null})),
      matches:matches.map(m=>({...m,competitionName:competitionsById.get(m.competitionId)??"",
        opponentName:names.get(m.homeTeamId===teamId?m.awayTeamId??"":m.homeTeamId??"")??"",
        startsAt:m.startsAt?.toISOString()??null})),
      activities:activities.map(a=>({...a,startsAt:a.startsAt.toISOString(),endsAt:a.endsAt.toISOString()})),
      responses,guests:guests.map(g=>({...g,createdAt:g.createdAt.toISOString()})),
      posts:posts.map(p=>({...p,publishedAt:p.publishedAt.toISOString()})),
      lineups:lineups.map(l=>({...l,updatedAt:l.updatedAt.toISOString()})),
      friendlies:friendlies.map(f=>({...f,opponentName:names.get(f.fromTeamId===teamId?f.toTeamId:f.fromTeamId)??"",
        proposedAt:f.proposedAt.toISOString(),createdAt:f.createdAt.toISOString()}))};
  }

  async createActivity(userId:string,teamId:string,input:z.infer<typeof activityInput>){
    await this.access(userId,teamId,true);
    if(Date.parse(input.startsAt)<=this.now().getTime())throw errors.badRequest("ACTIVITY_IN_PAST","Choose a future activity time.");
    const [created]=await this.db.insert(teamActivities).values({
      teamId,kind:input.kind,title:input.title,description:input.description??null,place:input.place??null,
      startsAt:new Date(input.startsAt),endsAt:new Date(input.endsAt),
    }).returning({id:teamActivities.id});
    return {id:created!.id};
  }
  async deleteActivity(userId:string,teamId:string,activityId:string){
    await this.access(userId,teamId,true);
    const [deleted]=await this.db.delete(teamActivities).where(and(eq(teamActivities.id,activityId),eq(teamActivities.teamId,teamId))).returning({id:teamActivities.id});
    if(!deleted)throw errors.badRequest("ACTIVITY_NOT_FOUND","Activity not found.");
    return {deleted:true};
  }
  async rsvp(userId:string,teamId:string,activityId:string,status:"AVAILABLE"|"UNAVAILABLE"|"UNSURE"){
    await this.access(userId,teamId);
    const [activity]=await this.db.select({id:teamActivities.id,endsAt:teamActivities.endsAt})
      .from(teamActivities).where(and(eq(teamActivities.id,activityId),eq(teamActivities.teamId,teamId))).limit(1);
    if(!activity||activity.endsAt<=this.now())throw errors.badRequest("ACTIVITY_CLOSED","This event is no longer available.");
    await this.db.insert(teamActivityResponses).values({activityId,userId,status,updatedAt:this.now()})
      .onConflictDoUpdate({target:[teamActivityResponses.activityId,teamActivityResponses.userId],set:{status,updatedAt:this.now()}});
    return {status};
  }
  async addGuest(userId:string,teamId:string,input:z.infer<typeof guestInput>){
    await this.access(userId,teamId,true);
    const [guest]=await this.db.insert(teamGuestPlayers).values({...input,teamId}).returning({id:teamGuestPlayers.id});
    return {id:guest!.id};
  }
  async removeGuest(userId:string,teamId:string,guestId:string){
    await this.access(userId,teamId,true);
    const [deleted]=await this.db.delete(teamGuestPlayers).where(and(eq(teamGuestPlayers.teamId,teamId),eq(teamGuestPlayers.id,guestId))).returning({id:teamGuestPlayers.id});
    if(!deleted)throw errors.badRequest("GUEST_NOT_FOUND","Guest not found.");
    return {deleted:true};
  }
  async saveLineup(userId:string,teamId:string,matchId:string,input:z.infer<typeof lineupInput>){
    await this.access(userId,teamId,true);
    const [match]=await this.db.select({id:competitionMatches.id,status:competitionMatches.status})
      .from(competitionMatches).where(and(eq(competitionMatches.id,matchId),
        or(eq(competitionMatches.homeTeamId,teamId),eq(competitionMatches.awayTeamId,teamId)))).limit(1);
    if(!match||["COMPLETED","CORRECTED","CANCELLED"].includes(match.status))
      throw errors.badRequest("LINEUP_LOCKED","No upcoming match available for this lineup.");
    const selected=[...input.startingUserIds,...input.substituteUserIds];
    const roster=selected.length?await this.db.select({userId:teamMemberships.userId}).from(teamMemberships)
      .where(and(eq(teamMemberships.teamId,teamId),eq(teamMemberships.status,"ACTIVE"),inArray(teamMemberships.userId,selected))):[];
    if(roster.length!==selected.length)throw errors.badRequest("LINEUP_INVALID","Use current registered team members only.");
    await this.db.insert(teamMatchLineups).values({matchId,teamId,...input,updatedAt:this.now()})
      .onConflictDoUpdate({target:[teamMatchLineups.matchId,teamMatchLineups.teamId],
        set:{startingUserIds:input.startingUserIds,substituteUserIds:input.substituteUserIds,updatedAt:this.now()}});
    return {saved:true};
  }
  async createPost(userId:string,teamId:string,input:{body:string;imageUrl?:string}){
    await this.access(userId,teamId,true);
    if(!input.body.trim()&&!input.imageUrl)throw errors.badRequest("POST_EMPTY","Write a post or choose a photo.");
    if(input.imageUrl?.startsWith("/")){
      const reference=/^\/api\/v1\/social\/post-images\/([0-9a-f-]{36})\/([A-Za-z0-9_-]{32,64})$/.exec(input.imageUrl);
      if(!reference)throw errors.badRequest("POST_IMAGE_INVALID","Choose an uploaded photo.");
      const [asset]=await this.db.select({id:socialUserPostImages.id})
        .from(socialUserPostImages).where(and(eq(socialUserPostImages.id,reference[1]!),
          eq(socialUserPostImages.publicToken,reference[2]!),eq(socialUserPostImages.ownerUserId,userId))).limit(1);
      if(!asset)throw errors.forbidden("POST_IMAGE_FORBIDDEN","The selected photo does not belong to your account.");
    }
    const [created]=await this.db.insert(socialPosts).values({
      entityType:"TEAM",entityId:teamId,createdByUserId:userId,body:input.body.trim(),
      imageUrl:input.imageUrl??null,postType:"GENERAL",visibility:"PUBLIC",status:"PUBLISHED",
      publishedAt:this.now(),createdAt:this.now(),updatedAt:this.now(),
    }).returning({id:socialPosts.id});
    return {id:created!.id};
  }
  async deletePost(userId:string,teamId:string,postId:string){
    await this.access(userId,teamId,true);
    const [deleted]=await this.db.update(socialPosts).set({status:"UNPUBLISHED",updatedAt:this.now()})
      .where(and(eq(socialPosts.id,postId),eq(socialPosts.entityType,"TEAM"),eq(socialPosts.entityId,teamId),eq(socialPosts.status,"PUBLISHED")))
      .returning({id:socialPosts.id});
    if(!deleted)throw errors.badRequest("POST_NOT_FOUND","Post not found.");
    return {deleted:true};
  }
  async challenge(userId:string,teamId:string,input:z.infer<typeof challengeInput>){
    await this.access(userId,teamId,true);
    if(teamId===input.toTeamId||Date.parse(input.proposedAt)<=this.now().getTime())
      throw errors.badRequest("INVALID_CHALLENGE","Choose another team and a future time.");
    const [opponent]=await this.db.select({id:teams.id,managerUserId:teams.managerUserId,
      status:teams.status,offlineVenueId:teams.offlineVenueId,claimedAt:teams.claimedAt})
      .from(teams).where(eq(teams.id,input.toTeamId)).limit(1);
    if(!opponent||opponent.status!=="ACTIVE"||(opponent.offlineVenueId&&!opponent.claimedAt))
      throw errors.badRequest("CHALLENGE_TEAM_NOT_FOUND","Choose a registered team.");
    const [created]=await this.db.insert(teamFriendlyChallenges).values({
      fromTeamId:teamId,toTeamId:input.toTeamId,proposedAt:new Date(input.proposedAt),
      place:input.place??null,
    }).returning({id:teamFriendlyChallenges.id});
    return {id:created!.id};
  }
  async respondChallenge(userId:string,teamId:string,challengeId:string,accept:boolean){
    await this.access(userId,teamId,true);
    const [updated]=await this.db.update(teamFriendlyChallenges).set({status:accept?"ACCEPTED":"DECLINED"})
      .where(and(eq(teamFriendlyChallenges.id,challengeId),eq(teamFriendlyChallenges.toTeamId,teamId),eq(teamFriendlyChallenges.status,"PENDING")))
      .returning({id:teamFriendlyChallenges.id});
    if(!updated)throw errors.conflict("CHALLENGE_UNAVAILABLE","This challenge is no longer pending.");
    return {accepted:accept};
  }
}
export function createTeamWorkspaceRouter(workspace:TeamWorkspaceService,tokens:TokenService){
  const router=Router();
  const auth=requireAuth(tokens);
  const limiter=rateLimit({windowMs:60_000,limit:60,standardHeaders:"draft-8",legacyHeaders:false});
  const handle=(fn:(userId:string,teamId:string,request:import("express").Request)=>Promise<unknown>,status=200)=>
    async(request:import("express").Request,response:import("express").Response,next:import("express").NextFunction)=>{
      try{response.status(status).json(await fn(request.auth!.userId,uuid.parse(request.params.teamId),request));}catch(e){next(e);}
    };
  router.get("/teams/:teamId/workspace",auth,handle((u,t)=>workspace.list(u,t)));
  router.post("/teams/:teamId/workspace/activities",auth,limiter,handle((u,t,r)=>workspace.createActivity(u,t,activityInput.parse(r.body)),201));
  router.delete("/teams/:teamId/workspace/activities/:id",auth,limiter,handle((u,t,r)=>workspace.deleteActivity(u,t,uuid.parse(r.params.id))));
  router.post("/teams/:teamId/workspace/activities/:id/rsvp",auth,limiter,handle((u,t,r)=>workspace.rsvp(u,t,uuid.parse(r.params.id),
    z.enum(["AVAILABLE","UNAVAILABLE","UNSURE"]).parse(r.body?.status))));
  router.post("/teams/:teamId/workspace/guests",auth,limiter,handle((u,t,r)=>workspace.addGuest(u,t,guestInput.parse(r.body)),201));
  router.delete("/teams/:teamId/workspace/guests/:id",auth,limiter,handle((u,t,r)=>workspace.removeGuest(u,t,uuid.parse(r.params.id))));
  router.put("/teams/:teamId/workspace/lineups/:id",auth,limiter,handle((u,t,r)=>workspace.saveLineup(u,t,uuid.parse(r.params.id),lineupInput.parse(r.body))));
  router.post("/teams/:teamId/workspace/posts",auth,limiter,handle((u,t,r)=>workspace.createPost(u,t,
    z.object({body:z.string().max(3000),imageUrl:z.string().refine(x=>x.startsWith("https://")||/^\/api\/v1\/social\/post-images\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{32,64}$/.test(x)).optional()}).parse(r.body)),201));
  router.delete("/teams/:teamId/workspace/posts/:id",auth,limiter,handle((u,t,r)=>workspace.deletePost(u,t,uuid.parse(r.params.id))));
  router.post("/teams/:teamId/workspace/challenges",auth,limiter,handle((u,t,r)=>workspace.challenge(u,t,challengeInput.parse(r.body)),201));
  router.post("/teams/:teamId/workspace/challenges/:id/respond",auth,limiter,handle((u,t,r)=>workspace.respondChallenge(u,t,uuid.parse(r.params.id),z.object({accept:z.boolean()}).parse(r.body).accept)));
  return router;
}
