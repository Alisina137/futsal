import {Router,type Request,type Response,type NextFunction} from "express";
import {rateLimit} from "express-rate-limit";
import {z} from "zod";
import {and,asc,desc,eq,inArray,or,sql} from "drizzle-orm";
import type {Database} from "@leaguekick/database";
import {competitionMatches,playerMatchStats,teamActivities,teamActivityResponses,
  playerDashboardPreferences,teamJoinRequests,teamMemberships,teams} from "@leaguekick/database";
import {errors} from "../../lib/errors.js";
import {requireAuth} from "../../middleware/auth.js";
import type {TokenService} from "../auth/token.service.js";
import type {TeamService} from "./team.service.js";

const uuid=z.string().uuid();
export const preferencesSchema=z.object({
  defaultTeamId:uuid.nullable().optional(),
  biography:z.string().trim().max(500).nullable().optional(),
  province:z.string().trim().max(80).nullable().optional(),
  district:z.string().trim().max(80).nullable().optional(),
  secondaryPosition:z.enum(["UNSPECIFIED","GOALKEEPER","FIXO","ALA","PIVO","UNIVERSAL"]).nullable().optional(),
  preferredFoot:z.enum(["LEFT","RIGHT","BOTH"]).nullable().optional(),
}).strict();
function date(value:Date|null){return value?.toISOString()??null;}
export function selectedTeamId(ownedIds:string[],preferred:string|null){
  return preferred&&ownedIds.includes(preferred)?preferred:ownedIds[0]??null;
}
export function assertCanLeaveTeam(isManager:boolean,isActive:boolean){
  if(isManager)throw errors.conflict("TEAM_MANAGER_TRANSFER_REQUIRED","Transfer team management before leaving.");
  if(!isActive)throw errors.conflict("TEAM_MEMBERSHIP_UNAVAILABLE","You are not an active member of this team.");
}
export class PlayerDashboardPhase1Service{
  constructor(private readonly db:Database,private readonly teamsService:TeamService,
    private readonly now:()=>Date=()=>new Date()){}
  private async ensureIdentity(userId:string){return this.teamsService.getOwnProfile(userId);}
  private async activeTeams(userId:string){
    const list=(await this.teamsService.listMyTeams(userId)).teams;
    return list;
  }
  async preferences(userId:string){
    await this.ensureIdentity(userId);
    const [row]=await this.db.select().from(playerDashboardPreferences)
      .where(eq(playerDashboardPreferences.userId,userId)).limit(1);
    return {defaultTeamId:row?.defaultTeamId??null,biography:row?.biography??null,
      province:row?.province??null,district:row?.district??null,
      secondaryPosition:row?.secondaryPosition??null,preferredFoot:row?.preferredFoot??null};
  }
  async savePreferences(userId:string,input:z.infer<typeof preferencesSchema>){
    await this.ensureIdentity(userId);
    if(input.defaultTeamId){
      const [membership]=await this.db.select({teamId:teamMemberships.teamId}).from(teamMemberships)
        .innerJoin(teams,eq(teamMemberships.teamId,teams.id))
        .where(and(eq(teamMemberships.teamId,input.defaultTeamId),eq(teamMemberships.userId,userId),
          eq(teamMemberships.status,"ACTIVE"),eq(teams.status,"ACTIVE"),
          or(sql`${teams.offlineVenueId} IS NULL`,sql`${teams.claimedAt} IS NOT NULL`))).limit(1);
      if(!membership)throw errors.forbidden("DEFAULT_TEAM_NOT_MEMBER","Choose a team you currently belong to.");
    }
    if(input.secondaryPosition===undefined&&input.preferredFoot===undefined&&input.province===undefined&&
      input.district===undefined&&input.biography===undefined&&input.defaultTeamId===undefined)
      throw errors.badRequest("PREFERENCES_EMPTY","Select an option to update.");
    const patch={...input,updatedAt:this.now()};
    await this.db.insert(playerDashboardPreferences).values({userId,...patch})
      .onConflictDoUpdate({target:playerDashboardPreferences.userId,set:patch});
    return {preferences:await this.preferences(userId)};
  }
  async outgoingRequests(userId:string){
    await this.ensureIdentity(userId);
    const rows=await this.db.select({id:teamJoinRequests.id,teamId:teamJoinRequests.teamId,
      teamName:teams.name,status:teamJoinRequests.status,
      createdAt:teamJoinRequests.createdAt,respondedAt:teamJoinRequests.respondedAt})
      .from(teamJoinRequests).innerJoin(teams,eq(teams.id,teamJoinRequests.teamId))
      .where(eq(teamJoinRequests.requesterUserId,userId))
      .orderBy(desc(teamJoinRequests.createdAt)).limit(80);
    return {requests:rows.map(r=>({...r,createdAt:r.createdAt.toISOString(),respondedAt:date(r.respondedAt)}))};
  }
  async cancelJoinRequest(userId:string,id:string){
    await this.ensureIdentity(userId);
    const [updated]=await this.db.update(teamJoinRequests).set({status:"CANCELLED",
      respondedAt:this.now(),updatedAt:this.now()})
      .where(and(eq(teamJoinRequests.id,id),eq(teamJoinRequests.requesterUserId,userId),
        eq(teamJoinRequests.status,"PENDING")))
      .returning({id:teamJoinRequests.id});
    if(!updated)throw errors.conflict("JOIN_REQUEST_UNAVAILABLE","This request is no longer pending.");
    return {cancelled:true};
  }
  async leaveTeam(userId:string,teamId:string){
    await this.ensureIdentity(userId);
    await this.db.transaction(async tx=>{
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${teamId}))`);
      const [team]=await tx.select({managerUserId:teams.managerUserId,status:teams.status})
        .from(teams).where(eq(teams.id,teamId)).limit(1);
      if(!team||team.status!=="ACTIVE")throw errors.badRequest("TEAM_NOT_FOUND","Team unavailable.");
      const [membership]=await tx.select({status:teamMemberships.status})
        .from(teamMemberships).where(and(eq(teamMemberships.teamId,teamId),
          eq(teamMemberships.userId,userId))).limit(1);
      assertCanLeaveTeam(team.managerUserId===userId,membership?.status==="ACTIVE");
      await tx.update(teamMemberships).set({status:"REMOVED",leftAt:this.now(),updatedAt:this.now()})
        .where(and(eq(teamMemberships.teamId,teamId),eq(teamMemberships.userId,userId)));
      await tx.update(teams).set({captainUserId:null,updatedAt:this.now()})
        .where(and(eq(teams.id,teamId),eq(teams.captainUserId,userId)));
      await tx.update(playerDashboardPreferences).set({defaultTeamId:null,updatedAt:this.now()})
        .where(and(eq(playerDashboardPreferences.userId,userId),
          eq(playerDashboardPreferences.defaultTeamId,teamId)));
    });
    return {left:true};
  }
  async overview(userId:string){
    const [profile,myTeams,prefs,requests,invites]=await Promise.all([
      this.ensureIdentity(userId),this.activeTeams(userId),this.preferences(userId),
      this.outgoingRequests(userId),this.teamsService.listMyInvitations(userId)]);
    const ids=myTeams.map(x=>x.id);
    const chosen=selectedTeamId(ids,prefs.defaultTeamId);
    if(!ids.length)return {profile,teams:myTeams,selectedTeamId:chosen,
      preferences:prefs,requests:requests.requests,invitations:invites.invitations,
      stats:{matches:0,goals:0,assists:0,awards:0},nextMatch:null,activities:[],recentMatches:[]};
    const [fixtures,performances,activities]=await Promise.all([
      this.db.select({id:competitionMatches.id,competitionId:competitionMatches.competitionId,
        homeTeamId:competitionMatches.homeTeamId,awayTeamId:competitionMatches.awayTeamId,
        status:competitionMatches.status,startsAt:competitionMatches.startsAt,
        homeScore:competitionMatches.homeScore,awayScore:competitionMatches.awayScore})
        .from(competitionMatches).where(or(inArray(competitionMatches.homeTeamId,ids),
          inArray(competitionMatches.awayTeamId,ids))).orderBy(asc(competitionMatches.startsAt)).limit(300),
      this.db.select({matchId:playerMatchStats.matchId,goals:playerMatchStats.goals,
        assists:playerMatchStats.assists,appeared:playerMatchStats.appeared,
        best:playerMatchStats.playerOfMatch,matchStatus:competitionMatches.status,
        startsAt:competitionMatches.startsAt,homeScore:competitionMatches.homeScore,
        awayScore:competitionMatches.awayScore,homeTeamId:competitionMatches.homeTeamId,
        awayTeamId:competitionMatches.awayTeamId,teamId:playerMatchStats.teamId})
        .from(playerMatchStats).innerJoin(competitionMatches,eq(competitionMatches.id,playerMatchStats.matchId))
        .where(and(eq(playerMatchStats.playerUserId,userId),inArray(playerMatchStats.teamId,ids)))
        .orderBy(desc(competitionMatches.startsAt)).limit(400),
      this.db.select({id:teamActivities.id,teamId:teamActivities.teamId,kind:teamActivities.kind,
        title:teamActivities.title,location:teamActivities.location,startsAt:teamActivities.startsAt,
        endsAt:teamActivities.endsAt,availability:teamActivityResponses.availability})
        .from(teamActivities).leftJoin(teamActivityResponses,and(
          eq(teamActivityResponses.activityId,teamActivities.id),eq(teamActivityResponses.userId,userId)))
        .where(and(inArray(teamActivities.teamId,ids),sql`${teamActivities.endsAt} >= ${this.now()}`))
        .orderBy(asc(teamActivities.startsAt)).limit(20),
    ]);
    const official=performances.filter(x=>["COMPLETED","CORRECTED"].includes(x.matchStatus));
    const aggregates={matches:official.filter(x=>x.appeared).length,
      goals:official.reduce((n,x)=>n+x.goals,0),assists:official.reduce((n,x)=>n+x.assists,0),
      awards:official.filter(x=>x.best).length};
    const now=this.now();
    const next=fixtures.filter(x=>x.startsAt&&x.startsAt>=now&&
      x.status==="SCHEDULED")
      .sort((a,b)=>a.startsAt!.getTime()-b.startsAt!.getTime())[0]??null;
    const matchTeams=next?[next.homeTeamId,next.awayTeamId].filter((id):id is string=>Boolean(id)):[];
    const opponents=matchTeams.length?await this.db.select({id:teams.id,name:teams.name}).from(teams)
      .where(inArray(teams.id,matchTeams)):[];
    const names=new Map(opponents.map(x=>[x.id,x.name]));
    const nextMatch=next?{id:next.id,competitionId:next.competitionId,startsAt:date(next.startsAt),
      homeTeamName:names.get(next.homeTeamId??"")??"",awayTeamName:names.get(next.awayTeamId??"")??"",
      teamId:ids.find(id=>id===next.homeTeamId||id===next.awayTeamId)??null}:null;
    return {profile,teams:myTeams,selectedTeamId:chosen,preferences:prefs,
      requests:requests.requests,invitations:invites.invitations,
      stats:aggregates,nextMatch,
      activities:activities.map(x=>({...x,startsAt:x.startsAt.toISOString(),endsAt:x.endsAt.toISOString()})),
      recentMatches:official.slice(0,5).map(x=>({...x,startsAt:date(x.startsAt)}))};
  }
}
export function createPlayerDashboardPhase1Router(service:PlayerDashboardPhase1Service,tokens:TokenService){
  const router=Router(),auth=requireAuth(tokens);
  const limit=rateLimit({windowMs:60_000,limit:30,standardHeaders:"draft-8",legacyHeaders:false});
  const handle=(fn:(userId:string,req:Request)=>Promise<unknown>,status=200)=>
    async(req:Request,res:Response,next:NextFunction)=>{
      try{res.status(status).json(await fn(req.auth!.userId,req));}catch(e){next(e);}
    };
  router.get("/player-dashboard",auth,handle((user)=>service.overview(user)));
  router.get("/player-dashboard/preferences",auth,handle(async user=>({preferences:await service.preferences(user)})));
  router.patch("/player-dashboard/preferences",auth,limit,
    handle((user,req)=>service.savePreferences(user,preferencesSchema.parse(req.body))));
  router.get("/player-dashboard/join-requests",auth,handle(user=>service.outgoingRequests(user)));
  router.post("/player-dashboard/join-requests/:requestId/cancel",auth,limit,
    handle((user,req)=>service.cancelJoinRequest(user,uuid.parse(req.params.requestId))));
  router.post("/player-dashboard/teams/:teamId/leave",auth,limit,
    handle((user,req)=>service.leaveTeam(user,uuid.parse(req.params.teamId))));
  return router;
}
