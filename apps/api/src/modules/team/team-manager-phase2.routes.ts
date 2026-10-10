import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import type { Database } from "@leaguekick/database";
import {
  competitionMatches, competitions, competitionTeams, roleSubscriptions,
  teamActivities, teamActivityResponses, teamCompetitionRoster,
  teamMatchLineups, teamMemberships, teams, venues,
} from "@leaguekick/database";
import { errors } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";

const uuid=z.string().uuid();
const iso=z.string().datetime({offset:true});
const rosterInput=z.object({playerUserIds:z.array(uuid).max(40).refine(x=>new Set(x).size===x.length,"Duplicate players are not allowed.")});
const lineupInput=z.object({
  starters:z.array(uuid).max(5),
  substitutes:z.array(uuid).max(25),
  captainUserId:uuid.nullable(),
}).superRefine((v,ctx)=>{
  const ids=[...v.starters,...v.substitutes];
  if(new Set(ids).size!==ids.length)ctx.addIssue({code:"custom",message:"A player can only appear once."});
  if(v.captainUserId&&!ids.includes(v.captainUserId))
    ctx.addIssue({code:"custom",message:"The captain must be a selected player."});
});
const activityInput=z.object({
  kind:z.enum(["TRAINING","MEETING","FRIENDLY","OTHER"]),
  title:z.string().trim().min(2).max(120),
  notes:z.string().trim().max(1000).nullable(),
  location:z.string().trim().max(200).nullable(),
  startsAt:iso,endsAt:iso,
}).refine(v=>Date.parse(v.endsAt)>Date.parse(v.startsAt),"End time must follow start time.");

export type RegisteredCompetition={
  status:string;registrationStatus:string;registrationClosesAt:Date|null;startsAt:Date|null;
};

/** Registrar-controlled deadlines and finalized competitions always override manager wishes. */
export function assertRosterEditable(c:RegisteredCompetition,now:Date){
  if(c.registrationStatus!=="ACCEPTED")throw errors.conflict("ROSTER_REGISTRATION_REQUIRED","Your team must be accepted into this competition.");
  if(["IN_PROGRESS","COMPLETED","ARCHIVED","CANCELLED"].includes(c.status))
    throw errors.conflict("ROSTER_LOCKED","The competition has started or closed. Ask the organizer about roster changes.");
  const cutoff=c.registrationClosesAt??c.startsAt;
  if(cutoff&&cutoff<=now)throw errors.conflict("ROSTER_LOCKED","The competition roster deadline has passed.");
}

/** Never allow a player's selection unless they belong to the registered team and competition roster. */
export function assertEligibleSelection(ids:string[],registered:string[],roster:string[]){
  const eligible=new Set(registered.filter(x=>roster.includes(x)));
  if(ids.some(x=>!eligible.has(x)))throw errors.badRequest("PLAYER_NOT_ELIGIBLE","Choose players who are active members of this competition's roster.");
}

export class TeamManagerPhase2Service{
  constructor(private readonly db:Database,private readonly now:()=>Date=()=>new Date()){}

  private async access(userId:string,teamId:string,write=false,member=false){
    const [team]=await this.db.select({managerUserId:teams.managerUserId,status:teams.status,
      offlineVenueId:teams.offlineVenueId,claimedAt:teams.claimedAt})
      .from(teams).where(eq(teams.id,teamId)).limit(1);
    if(!team||team.status!=="ACTIVE"||(team.offlineVenueId&&!team.claimedAt))
      throw errors.badRequest("TEAM_NOT_FOUND","Team is not available.");
    const manager=team.managerUserId===userId;
    if(!manager&&member){
      const [m]=await this.db.select({userId:teamMemberships.userId}).from(teamMemberships)
        .where(and(eq(teamMemberships.teamId,teamId),eq(teamMemberships.userId,userId),eq(teamMemberships.status,"ACTIVE"))).limit(1);
      if(!m)throw errors.forbidden("TEAM_MEMBERSHIP_REQUIRED","Only current team members can access team activities.");
    }else if(!manager)throw errors.forbidden("TEAM_MANAGER_REQUIRED","Only this team's manager can access operations.");
    if(write){
      if(!manager)throw errors.forbidden("TEAM_MANAGER_REQUIRED","Only the team manager can change this team.");
      const [offer]=await this.db.select({status:roleSubscriptions.status,activeUntil:roleSubscriptions.activeUntil})
        .from(roleSubscriptions).where(and(eq(roleSubscriptions.userId,userId),eq(roleSubscriptions.role,"TEAM_MANAGER"))).limit(1);
      if(!offer||offer.status!=="ACTIVE"||!offer.activeUntil||offer.activeUntil<=this.now())
        throw errors.forbidden("TEAM_SUBSCRIPTION_REQUIRED","Renew your Team Manager subscription before making changes.");
    }
    return {manager};
  }

  private async competition(teamId:string,competitionId:string){
    const [row]=await this.db.select({
      id:competitions.id,name:competitions.name,status:competitions.status,
      registrationStatus:competitionTeams.status,registrationClosesAt:competitions.registrationClosesAt,
      startsAt:competitions.startsAt,
    }).from(competitionTeams).innerJoin(competitions,eq(competitionTeams.competitionId,competitions.id))
      .where(and(eq(competitionTeams.competitionId,competitionId),eq(competitionTeams.teamId,teamId))).limit(1);
    if(!row)throw errors.badRequest("TEAM_NOT_REGISTERED","Your team is not registered for this competition.");
    return row;
  }
  private async activePlayers(teamId:string){
    const rows=await this.db.select({userId:teamMemberships.userId}).from(teamMemberships)
      .where(and(eq(teamMemberships.teamId,teamId),eq(teamMemberships.status,"ACTIVE")));
    return rows.map(r=>r.userId);
  }
  private async rosterIds(teamId:string,competitionId:string){
    const rows=await this.db.select({userId:teamCompetitionRoster.userId}).from(teamCompetitionRoster)
      .where(and(eq(teamCompetitionRoster.teamId,teamId),eq(teamCompetitionRoster.competitionId,competitionId)));
    return rows.map(x=>x.userId);
  }
  private async match(teamId:string,matchId:string){
    const [record]=await this.db.select({
      id:competitionMatches.id,competitionId:competitionMatches.competitionId,
      status:competitionMatches.status,startsAt:competitionMatches.startsAt,
      homeTeamId:competitionMatches.homeTeamId,awayTeamId:competitionMatches.awayTeamId,
    }).from(competitionMatches)
      .where(and(eq(competitionMatches.id,matchId),or(eq(competitionMatches.homeTeamId,teamId),eq(competitionMatches.awayTeamId,teamId))))
      .limit(1);
    if(!record)throw errors.badRequest("TEAM_MATCH_NOT_FOUND","This match does not belong to your team.");
    return record;
  }

  async operations(userId:string,teamId:string){
    await this.access(userId,teamId);
    const [participations,fixtures,rosters,lineups,activities,responses]=await Promise.all([
      this.db.select({id:competitions.id,name:competitions.name,format:competitions.format,
        status:competitions.status,published:competitions.published,
        venueName:venues.name,venueId:competitions.venueId,
        registrationStatus:competitionTeams.status,feeStatus:competitionTeams.feeStatus,
        registrationClosesAt:competitions.registrationClosesAt,startsAt:competitions.startsAt,endsAt:competitions.endsAt})
        .from(competitionTeams).innerJoin(competitions,eq(competitions.id,competitionTeams.competitionId))
        .innerJoin(venues,eq(venues.id,competitions.venueId))
        .where(eq(competitionTeams.teamId,teamId)).orderBy(desc(competitions.createdAt)),
      this.db.select({id:competitionMatches.id,competitionId:competitionMatches.competitionId,
        homeTeamId:competitionMatches.homeTeamId,awayTeamId:competitionMatches.awayTeamId,
        status:competitionMatches.status,stage:competitionMatches.stage,round:competitionMatches.roundNumber,
        startsAt:competitionMatches.startsAt,endsAt:competitionMatches.endsAt,
        homeScore:competitionMatches.homeScore,awayScore:competitionMatches.awayScore})
        .from(competitionMatches).where(or(eq(competitionMatches.homeTeamId,teamId),eq(competitionMatches.awayTeamId,teamId))),
      this.db.select({competitionId:teamCompetitionRoster.competitionId,userId:teamCompetitionRoster.userId})
        .from(teamCompetitionRoster).where(eq(teamCompetitionRoster.teamId,teamId)),
      this.db.select({matchId:teamMatchLineups.matchId,starters:teamMatchLineups.starters,
        substitutes:teamMatchLineups.substitutes,captainUserId:teamMatchLineups.captainUserId})
        .from(teamMatchLineups).where(eq(teamMatchLineups.teamId,teamId)),
      this.db.select().from(teamActivities).where(eq(teamActivities.teamId,teamId)).orderBy(asc(teamActivities.startsAt)),
      this.db.select({activityId:teamActivityResponses.activityId,userId:teamActivityResponses.userId,
        availability:teamActivityResponses.availability})
        .from(teamActivityResponses).innerJoin(teamActivities,eq(teamActivities.id,teamActivityResponses.activityId))
        .where(eq(teamActivities.teamId,teamId)),
    ]);
    const rivalIds=[...new Set(fixtures.flatMap(f=>[f.homeTeamId,f.awayTeamId]).filter((v):v is string=>Boolean(v)&&v!==teamId))];
    const rivals=rivalIds.length?await this.db.select({id:teams.id,name:teams.name}).from(teams).where(inArray(teams.id,rivalIds)):[];
    const rivalsById=new Map(rivals.map(r=>[r.id,r.name]));
    const compById=new Map(participations.map(c=>[c.id,c.name]));
    return {
      competitions:participations.map(c=>({...c,
        registrationClosesAt:c.registrationClosesAt?.toISOString()??null,
        startsAt:c.startsAt?.toISOString()??null,endsAt:c.endsAt?.toISOString()??null,
        rosterUserIds:rosters.filter(r=>r.competitionId===c.id).map(r=>r.userId),
        rosterLocked:(()=>{
          try{assertRosterEditable({status:c.status,registrationStatus:c.registrationStatus,
            registrationClosesAt:c.registrationClosesAt,startsAt:c.startsAt},this.now());return false;}catch{return true;}
        })(),
      })),
      matches:fixtures.map(f=>({...f,
        competitionName:compById.get(f.competitionId)??"",
        opponentName:rivalsById.get((f.homeTeamId===teamId?f.awayTeamId:f.homeTeamId)??"")??null,
        startsAt:f.startsAt?.toISOString()??null,endsAt:f.endsAt?.toISOString()??null,
        lineup:lineups.find(l=>l.matchId===f.id)??null,
      })),
      activities:activities.map(a=>({...a,
        startsAt:a.startsAt.toISOString(),endsAt:a.endsAt.toISOString(),
        rsvps:responses.filter(v=>v.activityId===a.id)})),
    };
  }

  async replaceRoster(userId:string,teamId:string,competitionId:string,ids:string[]){
    await this.access(userId,teamId,true);
    const competition=await this.competition(teamId,competitionId);
    assertRosterEditable(competition,this.now());
    const active=await this.activePlayers(teamId);
    if(ids.some(id=>!active.includes(id)))throw errors.badRequest("INVALID_ROSTER","Use active registered team members only. Temporary players are not eligible.");
    // A roster cannot drop a player who already appears in a saved, active match lineup.
    const scheduled=await this.db.select({matchId:competitionMatches.id}).from(competitionMatches)
      .where(and(eq(competitionMatches.competitionId,competitionId),or(eq(competitionMatches.homeTeamId,teamId),eq(competitionMatches.awayTeamId,teamId))));
    if(scheduled.length){
      const saved=await this.db.select({starters:teamMatchLineups.starters,substitutes:teamMatchLineups.substitutes})
        .from(teamMatchLineups).where(and(eq(teamMatchLineups.teamId,teamId),inArray(teamMatchLineups.matchId,scheduled.map(x=>x.matchId))));
      const removed=saved.flatMap(x=>[...x.starters,...x.substitutes]).filter(x=>!ids.includes(x));
      if(removed.length)throw errors.conflict("ROSTER_LINEUP_CONFLICT","Remove players from the saved match lineup first.");
    }
    await this.db.transaction(async tx=>{
      await tx.delete(teamCompetitionRoster).where(and(eq(teamCompetitionRoster.teamId,teamId),eq(teamCompetitionRoster.competitionId,competitionId)));
      if(ids.length)await tx.insert(teamCompetitionRoster).values(ids.map(player=>({teamId,competitionId,userId:player})));
    });
    return {playerUserIds:ids};
  }

  async saveLineup(userId:string,teamId:string,matchId:string,input:z.infer<typeof lineupInput>){
    await this.access(userId,teamId,true);
    const match=await this.match(teamId,matchId);
    if(["COMPLETED","CORRECTED","CANCELLED","IN_PROGRESS"].includes(match.status))
      throw errors.conflict("LINEUP_LOCKED","This match is underway or has finished.");
    if(match.startsAt&&match.startsAt<=this.now())throw errors.conflict("LINEUP_LOCKED","The match start time has passed.");
    const competition=await this.competition(teamId,match.competitionId);
    if(competition.registrationStatus!=="ACCEPTED")throw errors.forbidden("MATCH_REGISTRATION_REQUIRED","Team registration must be accepted.");
    const [roster,active]=await Promise.all([this.rosterIds(teamId,match.competitionId),this.activePlayers(teamId)]);
    const ids=[...input.starters,...input.substitutes];
    if(!roster.length&&ids.length)throw errors.badRequest("ROSTER_REQUIRED","Choose a competition roster before assigning a lineup.");
    assertEligibleSelection(ids,active,roster);
    await this.db.insert(teamMatchLineups).values({matchId,teamId,...input,updatedAt:this.now()})
      .onConflictDoUpdate({target:[teamMatchLineups.matchId,teamMatchLineups.teamId],
        set:{starters:input.starters,substitutes:input.substitutes,captainUserId:input.captainUserId,updatedAt:this.now()}});
    return {saved:true};
  }

  private async activity(teamId:string,id:string){
    const [item]=await this.db.select().from(teamActivities).where(and(eq(teamActivities.id,id),eq(teamActivities.teamId,teamId))).limit(1);
    if(!item)throw errors.badRequest("ACTIVITY_NOT_FOUND","Activity does not belong to this team.");
    return item;
  }
  async memberActivities(userId:string,teamId:string){
    await this.access(userId,teamId,false,true);
    const activities=await this.db.select().from(teamActivities)
      .where(eq(teamActivities.teamId,teamId)).orderBy(asc(teamActivities.startsAt));
    const answers=await this.db.select({activityId:teamActivityResponses.activityId,
      availability:teamActivityResponses.availability}).from(teamActivityResponses)
      .where(eq(teamActivityResponses.userId,userId));
    return {activities:activities.map(a=>({...a,
      startsAt:a.startsAt.toISOString(),endsAt:a.endsAt.toISOString(),
      myAvailability:answers.find(v=>v.activityId===a.id)?.availability??null}))};
  }
  async createActivity(userId:string,teamId:string,input:z.infer<typeof activityInput>){
    await this.access(userId,teamId,true);
    if(Date.parse(input.startsAt)<=this.now().getTime())
      throw errors.badRequest("ACTIVITY_IN_PAST","Choose a future start date.");
    const [item]=await this.db.insert(teamActivities).values({...input,teamId,
      startsAt:new Date(input.startsAt),endsAt:new Date(input.endsAt)}).returning({id:teamActivities.id});
    return {id:item!.id};
  }
  async updateActivity(userId:string,teamId:string,id:string,input:z.infer<typeof activityInput>){
    await this.access(userId,teamId,true);
    const old=await this.activity(teamId,id);
    if(old.endsAt<=this.now())throw errors.conflict("ACTIVITY_FINISHED","Cannot edit a finished activity.");
    if(Date.parse(input.startsAt)<=this.now().getTime())throw errors.badRequest("ACTIVITY_IN_PAST","Choose a future start date.");
    const [item]=await this.db.update(teamActivities).set({...input,
      startsAt:new Date(input.startsAt),endsAt:new Date(input.endsAt),updatedAt:this.now()})
      .where(and(eq(teamActivities.id,id),eq(teamActivities.teamId,teamId))).returning({id:teamActivities.id});
    return {id:item!.id};
  }
  async deleteActivity(userId:string,teamId:string,id:string){
    await this.access(userId,teamId,true);
    const [deleted]=await this.db.delete(teamActivities).where(and(eq(teamActivities.teamId,teamId),eq(teamActivities.id,id)))
      .returning({id:teamActivities.id});
    if(!deleted)throw errors.badRequest("ACTIVITY_NOT_FOUND","Activity not found.");
    return {deleted:true};
  }
  async rsvp(userId:string,teamId:string,id:string,availability:"AVAILABLE"|"UNAVAILABLE"|"UNSURE"){
    await this.access(userId,teamId,false,true);
    const activity=await this.activity(teamId,id);
    if(activity.startsAt<=this.now())throw errors.conflict("ACTIVITY_STARTED","Availability closed once an activity starts.");
    await this.db.insert(teamActivityResponses).values({activityId:id,userId,availability,updatedAt:this.now()})
      .onConflictDoUpdate({target:[teamActivityResponses.activityId,teamActivityResponses.userId],
        set:{availability,updatedAt:this.now()}});
    return {availability};
  }
}

export function createTeamManagerPhase2Router(service:TeamManagerPhase2Service,tokens:TokenService){
  const router=Router(),auth=requireAuth(tokens);
  const limiter=rateLimit({windowMs:60_000,limit:50,standardHeaders:"draft-8",legacyHeaders:false});
  const action=(fn:(userId:string,teamId:string,request:Request)=>Promise<unknown>,status=200)=>
    async(req:Request,res:Response,next:NextFunction)=>{try{
      res.status(status).json(await fn(req.auth!.userId,uuid.parse(req.params.teamId),req));
    }catch(e){next(e);}};
  router.get("/teams/:teamId/manager/operations",auth,action((u,t)=>service.operations(u,t)));
  router.put("/teams/:teamId/manager/competitions/:competitionId/roster",auth,limiter,
    action((u,t,r)=>service.replaceRoster(u,t,uuid.parse(r.params.competitionId),rosterInput.parse(r.body).playerUserIds)));
  router.put("/teams/:teamId/manager/matches/:matchId/lineup",auth,limiter,
    action((u,t,r)=>service.saveLineup(u,t,uuid.parse(r.params.matchId),lineupInput.parse(r.body))));
  router.get("/teams/:teamId/activities",auth,action((u,t)=>service.memberActivities(u,t)));
  router.post("/teams/:teamId/manager/activities",auth,limiter,
    action((u,t,r)=>service.createActivity(u,t,activityInput.parse(r.body)),201));
  router.put("/teams/:teamId/manager/activities/:activityId",auth,limiter,
    action((u,t,r)=>service.updateActivity(u,t,uuid.parse(r.params.activityId),activityInput.parse(r.body))));
  router.delete("/teams/:teamId/manager/activities/:activityId",auth,limiter,
    action((u,t,r)=>service.deleteActivity(u,t,uuid.parse(r.params.activityId))));
  router.post("/teams/:teamId/activities/:activityId/availability",auth,limiter,
    action((u,t,r)=>service.rsvp(u,t,uuid.parse(r.params.activityId),
      z.enum(["AVAILABLE","UNAVAILABLE","UNSURE"]).parse(r.body?.availability))));
  return router;
}
