import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { Database } from "@leaguekick/database";
import { and, asc, eq, gte, inArray, or } from "drizzle-orm";
import { competitionMatches, competitionTeams, competitions, roleSubscriptions,
  teamGuestPlayers, teamManagerProfiles, teamMemberships, teams } from "@leaguekick/database";
import { errors } from "../../lib/errors.js";
import {teamLicenseActive,requireTeamLicense} from "./team-slots.js";
import { requireAuth } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";

const id=z.string().uuid();
const optionalText=(max:number)=>z.string().trim().max(max).nullable();
const profileInput=z.object({
  province:optionalText(80),
  district:optionalText(80),
  description:optionalText(600),
  foundedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
    const d=new Date(value+"T00:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
  }).nullable(),
  primaryColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  secondaryColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  contactPhone:optionalText(24),
  homeVenueId:id.nullable(),
  allowJoinRequests:z.boolean(),
});
const guestInput=z.object({
  name:z.string().trim().min(2).max(100),
  position:z.enum(["UNSPECIFIED","GOALKEEPER","FIXO","ALA","PIVO","UNIVERSAL"]),
  shirtNumber:z.number().int().min(1).max(99).nullable(),
});

export class TeamManagerPhase1Service {
  constructor(private readonly db:Database,private readonly now:()=>Date=()=>new Date()){}
  private async team(userId:string,teamId:string,write=false){
    const [team]=await this.db.select({id:teams.id,managerUserId:teams.managerUserId,
      offlineVenueId:teams.offlineVenueId,claimedAt:teams.claimedAt,status:teams.status})
      .from(teams).where(eq(teams.id,teamId)).limit(1);
    if(!team||team.managerUserId!==userId||team.status!=="ACTIVE"||(team.offlineVenueId&&!team.claimedAt)){
      throw errors.forbidden("TEAM_MANAGER_REQUIRED","You do not manage this active team.");
    }
    const canWrite=await teamLicenseActive(this.db,userId,teamId,this.now());
    if(write&&!canWrite)throw errors.forbidden("TEAM_SUBSCRIPTION_REQUIRED","Renew this team's subscription to manage it.");
    return {canWrite};
  }
  private async guestShirtAvailable(teamId:string,shirtNumber:number|null,excludeId?:string){
    if(shirtNumber===null)return;
    const [real]=await this.db.select({userId:teamMemberships.userId}).from(teamMemberships)
      .where(and(eq(teamMemberships.teamId,teamId),eq(teamMemberships.status,"ACTIVE"),eq(teamMemberships.shirtNumber,shirtNumber))).limit(1);
    const guests=await this.db.select({id:teamGuestPlayers.id}).from(teamGuestPlayers)
      .where(and(eq(teamGuestPlayers.teamId,teamId),eq(teamGuestPlayers.shirtNumber,shirtNumber)));
    if(real||guests.some(guest=>guest.id!==excludeId))
      throw errors.conflict("TEAM_SHIRT_IN_USE","This jersey number is already in use.");
  }
  private async details(teamId:string){
    const [record]=await this.db.select().from(teamManagerProfiles).where(eq(teamManagerProfiles.teamId,teamId)).limit(1);
    return {
      province:record?.province??null,district:record?.district??null,
      description:record?.description??null,foundedOn:record?.foundedOn??null,
      primaryColor:record?.primaryColor??null,secondaryColor:record?.secondaryColor??null,
      contactPhone:record?.contactPhone??null,homeVenueId:record?.homeVenueId??null,
      allowJoinRequests:record?.allowJoinRequests??true,
    };
  }
  async publicDetails(teamId:string){
    const [team]=await this.db.select({id:teams.id,status:teams.status,privacy:teams.privacy,
      offlineVenueId:teams.offlineVenueId,claimedAt:teams.claimedAt})
      .from(teams).where(eq(teams.id,teamId)).limit(1);
    if(!team||team.status!=="ACTIVE"||team.privacy!=="PUBLIC"||(team.offlineVenueId&&!team.claimedAt))
      throw errors.badRequest("TEAM_NOT_FOUND","This team profile is not public.");
    const details=await this.details(teamId);
    const {allowJoinRequests:_,...publicFields}=details;
    return {profile:publicFields};
  }
  async overview(userId:string,teamId:string){
    const access=await this.team(userId,teamId);
    const [profile,guests,registrations,matches]=await Promise.all([
      this.details(teamId),
      this.db.select().from(teamGuestPlayers).where(eq(teamGuestPlayers.teamId,teamId)).orderBy(asc(teamGuestPlayers.name)),
      this.db.select({competitionId:competitionTeams.competitionId}).from(competitionTeams)
        .where(and(eq(competitionTeams.teamId,teamId),eq(competitionTeams.status,"ACCEPTED"))),
      this.db.select({id:competitionMatches.id,competitionId:competitionMatches.competitionId,
        homeTeamId:competitionMatches.homeTeamId,awayTeamId:competitionMatches.awayTeamId,
        homeScore:competitionMatches.homeScore,awayScore:competitionMatches.awayScore,
        startsAt:competitionMatches.startsAt,status:competitionMatches.status})
        .from(competitionMatches).where(or(eq(competitionMatches.homeTeamId,teamId),eq(competitionMatches.awayTeamId,teamId))),
    ]);
    const finalized=matches.filter(m=>(m.status==="COMPLETED"||m.status==="CORRECTED")&&m.homeScore!==null&&m.awayScore!==null);
    const wins=finalized.filter(m=>m.homeTeamId===teamId?m.homeScore!>m.awayScore!:m.awayScore!>m.homeScore!).length;
    const future=matches.filter(m=>!!m.startsAt&&m.startsAt>=this.now()&&["SCHEDULED","IN_PROGRESS"].includes(m.status))
      .sort((a,b)=>a.startsAt!.getTime()-b.startsAt!.getTime());
    const next=future[0]??null;
    let nextMatch:null|{id:string;competitionId:string;competitionName:string;opponentName:string;startsAt:string}=null;
    if(next){
      const opponentId=next.homeTeamId===teamId?next.awayTeamId:next.homeTeamId;
      const [[c],[opponent]]=await Promise.all([
        this.db.select({name:competitions.name}).from(competitions).where(eq(competitions.id,next.competitionId)).limit(1),
        opponentId?this.db.select({name:teams.name}).from(teams).where(eq(teams.id,opponentId)).limit(1):Promise.resolve([]),
      ]);
      nextMatch={id:next.id,competitionId:next.competitionId,competitionName:c?.name??"",
        opponentName:opponent?.name??"",startsAt:next.startsAt!.toISOString()};
    }
    return {canWrite:access.canWrite,profile,guests:guests.map(g=>({...g,createdAt:g.createdAt.toISOString()})),
      stats:{competitions:registrations.length,played:finalized.length,wins},nextMatch};
  }
  async updateProfile(userId:string,teamId:string,input:z.infer<typeof profileInput>){
    await this.team(userId,teamId,true);
    const data={...input,updatedAt:this.now()};
    await this.db.insert(teamManagerProfiles).values({teamId,...data})
      .onConflictDoUpdate({target:teamManagerProfiles.teamId,set:data});
    return {profile:await this.details(teamId)};
  }
  async addGuest(userId:string,teamId:string,input:z.infer<typeof guestInput>){
    await this.team(userId,teamId,true);
    await this.guestShirtAvailable(teamId,input.shirtNumber);
    const [guest]=await this.db.insert(teamGuestPlayers).values({teamId,...input}).returning();
    return {guest:{...guest!,createdAt:guest!.createdAt.toISOString()}};
  }
  async updateGuest(userId:string,teamId:string,guestId:string,input:z.infer<typeof guestInput>){
    await this.team(userId,teamId,true);
    await this.guestShirtAvailable(teamId,input.shirtNumber,guestId);
    const [guest]=await this.db.update(teamGuestPlayers).set(input)
      .where(and(eq(teamGuestPlayers.id,guestId),eq(teamGuestPlayers.teamId,teamId))).returning();
    if(!guest)throw errors.badRequest("GUEST_NOT_FOUND","Guest player not found.");
    return {guest:{...guest,createdAt:guest.createdAt.toISOString()}};
  }
  async removeGuest(userId:string,teamId:string,guestId:string){
    await this.team(userId,teamId,true);
    const [guest]=await this.db.delete(teamGuestPlayers)
      .where(and(eq(teamGuestPlayers.id,guestId),eq(teamGuestPlayers.teamId,teamId)))
      .returning({id:teamGuestPlayers.id});
    if(!guest)throw errors.badRequest("GUEST_NOT_FOUND","Guest player not found.");
    return {deleted:true};
  }
}

export function createTeamManagerPhase1Router(service:TeamManagerPhase1Service,tokens:TokenService){
  const router=Router();const auth=requireAuth(tokens);
  const limiter=rateLimit({windowMs:60_000,limit:40,standardHeaders:"draft-8",legacyHeaders:false});
  const handle=(fn:(userId:string,teamId:string,req:Request)=>Promise<unknown>,status=200)=>
    async(req:Request,res:Response,next:NextFunction)=>{
      try{res.status(status).json(await fn(req.auth!.userId,id.parse(req.params.teamId),req));}
      catch(e){next(e);}
    };
  router.get("/teams/:teamId/manager/overview",auth,handle((u,t)=>service.overview(u,t)));
  router.put("/teams/:teamId/manager/profile",auth,limiter,
    handle((u,t,req)=>service.updateProfile(u,t,profileInput.parse(req.body))));
  router.post("/teams/:teamId/manager/guests",auth,limiter,
    handle((u,t,req)=>service.addGuest(u,t,guestInput.parse(req.body)),201));
  router.put("/teams/:teamId/manager/guests/:guestId",auth,limiter,
    handle((u,t,req)=>service.updateGuest(u,t,id.parse(req.params.guestId),guestInput.parse(req.body))));
  router.delete("/teams/:teamId/manager/guests/:guestId",auth,limiter,
    handle((u,t,req)=>service.removeGuest(u,t,id.parse(req.params.guestId))));
  router.get("/teams/:teamId/profile-details",async(req,res,next)=>{
    try{res.json(await service.publicDetails(id.parse(req.params.teamId)));}
    catch(e){next(e);}
  });
  return router;
}
