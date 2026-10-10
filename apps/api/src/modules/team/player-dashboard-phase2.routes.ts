import {Router,type Request,type Response,type NextFunction} from "express";
import {and,asc,desc,eq,inArray,or} from "drizzle-orm";
import type {Database} from "@leaguekick/database";
import {competitionMatches,competitions,competitionTeams,playerMatchStats,teamActivities,
  teamActivityResponses,teamCompetitionRoster,teamFriendlyChallenges,teamMatchLineups,
  teams,venues} from "@leaguekick/database";
import {requireAuth} from "../../middleware/auth.js";
import type {TokenService} from "../auth/token.service.js";
import type {TeamService} from "./team.service.js";

const iso=(date:Date|null)=>date?.toISOString()??null;
export type PlayerMatchSelection="STARTER"|"SUBSTITUTE"|"NOT_SELECTED"|"NOT_PUBLISHED";
/** The private manager lineup is reduced to the requesting player's own selection. */
export function playerMatchSelection(lineup:{starters:string[];substitutes:string[]}|undefined,
  userId:string):PlayerMatchSelection{
  if(!lineup)return "NOT_PUBLISHED";
  if(lineup.starters.includes(userId))return "STARTER";
  if(lineup.substitutes.includes(userId))return "SUBSTITUTE";
  return "NOT_SELECTED";
}
export function playerScheduleOverlap(
  current:{startsAt:string;endsAt:string},other:{startsAt:string;endsAt:string}){
  return Date.parse(current.startsAt)<Date.parse(other.endsAt)&&
    Date.parse(other.startsAt)<Date.parse(current.endsAt);
}

/** This endpoint is for the signed-in individual, not an arbitrary user or a manager. */
export class PlayerDashboardPhase2Service{
  constructor(private readonly db:Database,private readonly teamService:TeamService){}
  async activities(userId:string){
    const mine=await this.teamService.listMyTeams(userId);
    // This list already excludes removed memberships, archived teams and unclaimed offline teams.
    const teamIds=mine.teams.map(t=>t.id);
    if(teamIds.length===0)return {competitions:[],matches:[],activities:[],friendlies:[]};
    const teamNames=new Map(mine.teams.map(t=>[t.id,t.name]));
    const [registered,rosters,games,lineups,records,events,answers,friendlies]=await Promise.all([
      this.db.select({id:competitions.id,name:competitions.name,format:competitions.format,
        status:competitions.status,published:competitions.published,
        startsAt:competitions.startsAt,endsAt:competitions.endsAt,
        registrationStatus:competitionTeams.status,teamId:competitionTeams.teamId,
        venueName:venues.name})
        .from(competitionTeams).innerJoin(competitions,eq(competitionTeams.competitionId,competitions.id))
        .innerJoin(venues,eq(competitions.venueId,venues.id))
        .where(inArray(competitionTeams.teamId,teamIds))
        .orderBy(desc(competitions.createdAt)).limit(250),
      this.db.select({competitionId:teamCompetitionRoster.competitionId,
        teamId:teamCompetitionRoster.teamId}).from(teamCompetitionRoster)
        .where(and(inArray(teamCompetitionRoster.teamId,teamIds),
          eq(teamCompetitionRoster.userId,userId))),
      this.db.select({id:competitionMatches.id,competitionId:competitionMatches.competitionId,
        homeTeamId:competitionMatches.homeTeamId,awayTeamId:competitionMatches.awayTeamId,
        status:competitionMatches.status,stage:competitionMatches.stage,
        startsAt:competitionMatches.startsAt,endsAt:competitionMatches.endsAt,
        homeScore:competitionMatches.homeScore,awayScore:competitionMatches.awayScore,
        venueId:competitionMatches.venueId})
        .from(competitionMatches)
        .where(or(inArray(competitionMatches.homeTeamId,teamIds),
          inArray(competitionMatches.awayTeamId,teamIds)))
        .orderBy(desc(competitionMatches.startsAt)).limit(500),
      this.db.select({matchId:teamMatchLineups.matchId,teamId:teamMatchLineups.teamId,
        starters:teamMatchLineups.starters,substitutes:teamMatchLineups.substitutes})
        .from(teamMatchLineups).where(inArray(teamMatchLineups.teamId,teamIds)),
      this.db.select({matchId:playerMatchStats.matchId,teamId:playerMatchStats.teamId,
        appeared:playerMatchStats.appeared,goals:playerMatchStats.goals,assists:playerMatchStats.assists,
        yellowCards:playerMatchStats.yellowCards,redCards:playerMatchStats.redCards,
        cleanSheet:playerMatchStats.cleanSheet,playerOfMatch:playerMatchStats.playerOfMatch})
        .from(playerMatchStats).where(and(eq(playerMatchStats.playerUserId,userId),
          inArray(playerMatchStats.teamId,teamIds))),
      this.db.select({id:teamActivities.id,teamId:teamActivities.teamId,kind:teamActivities.kind,
        title:teamActivities.title,notes:teamActivities.notes,location:teamActivities.location,
        startsAt:teamActivities.startsAt,endsAt:teamActivities.endsAt})
        .from(teamActivities).where(inArray(teamActivities.teamId,teamIds))
        .orderBy(desc(teamActivities.startsAt)).limit(300),
      this.db.select({activityId:teamActivityResponses.activityId,
        availability:teamActivityResponses.availability})
        .from(teamActivityResponses).where(eq(teamActivityResponses.userId,userId)),
      this.db.select({id:teamFriendlyChallenges.id,fromTeamId:teamFriendlyChallenges.fromTeamId,
        toTeamId:teamFriendlyChallenges.toTeamId,proposedAt:teamFriendlyChallenges.proposedAt,
        venueName:teamFriendlyChallenges.venueName,status:teamFriendlyChallenges.status})
        .from(teamFriendlyChallenges)
        .where(and(or(inArray(teamFriendlyChallenges.fromTeamId,teamIds),
          inArray(teamFriendlyChallenges.toTeamId,teamIds)),
          eq(teamFriendlyChallenges.status,"ACCEPTED")))
        .orderBy(desc(teamFriendlyChallenges.proposedAt)).limit(100),
    ]);
    const competitionNames=new Map(registered.map(c=>[c.id,c.name]));
    const ownRoster=new Set(rosters.map(r=>r.competitionId+":"+r.teamId));
    const lineupMap=new Map(lineups.map(l=>[l.matchId+":"+l.teamId,l]));
    const statsMap=new Map(records.map(r=>[r.matchId+":"+r.teamId,r]));
    const opponents=[...new Set([
      ...games.flatMap(g=>[g.homeTeamId,g.awayTeamId]),
      ...friendlies.flatMap(f=>[f.fromTeamId,f.toTeamId]),
    ].filter((x):x is string=>!!x))];
    if(opponents.length){
      const names=await this.db.select({id:teams.id,name:teams.name}).from(teams)
        .where(inArray(teams.id,opponents));
      for(const row of names)teamNames.set(row.id,row.name);
    }
    const venueIds=[...new Set(games.map(m=>m.venueId).filter((x):x is string=>!!x))];
    const names=venueIds.length?await this.db.select({id:venues.id,name:venues.name})
      .from(venues).where(inArray(venues.id,venueIds)):[];
    const venueNames=new Map(names.map(v=>[v.id,v.name]));
    const competitionsDto=registered.map(c=>({
      ...c,teamName:teamNames.get(c.teamId)??"",
      startsAt:iso(c.startsAt),endsAt:iso(c.endsAt),
      inRoster:ownRoster.has(c.id+":"+c.teamId),
    }));
    const matchesDto=games.flatMap(m=>{
      const matchingTeams=teamIds.filter(id=>id===m.homeTeamId||id===m.awayTeamId);
      return matchingTeams.map(teamId=>{
        const pick=playerMatchSelection(lineupMap.get(m.id+":"+teamId),userId);
        const recorded=statsMap.get(m.id+":"+teamId);
        const finalized=m.status==="COMPLETED"||m.status==="CORRECTED";
        const opponentId=teamId===m.homeTeamId?m.awayTeamId:m.homeTeamId;
        return {
          id:m.id,competitionId:m.competitionId,competitionName:competitionNames.get(m.competitionId)??"",
          teamId,teamName:teamNames.get(teamId)??"",opponentName:teamNames.get(opponentId??"")??"",
          homeTeamName:teamNames.get(m.homeTeamId??"")??"",
          awayTeamName:teamNames.get(m.awayTeamId??"")??"",
          venueName:venueNames.get(m.venueId??"")??null,
          status:m.status,stage:m.stage,startsAt:iso(m.startsAt),endsAt:iso(m.endsAt),
          homeScore:m.homeScore,awayScore:m.awayScore,lineupStatus:pick,
          myStatistics:finalized&&recorded?{appeared:recorded.appeared,goals:recorded.goals,
            assists:recorded.assists,yellowCards:recorded.yellowCards,
            redCards:recorded.redCards,cleanSheet:recorded.cleanSheet,
            playerOfMatch:recorded.playerOfMatch}:null,
        };
      });
    });
    const availability=new Map(answers.map(a=>[a.activityId,a.availability]));
    return {
      competitions:competitionsDto,
      matches:matchesDto,
      activities:events.map(a=>({...a,teamName:teamNames.get(a.teamId)??"",
        startsAt:a.startsAt.toISOString(),endsAt:a.endsAt.toISOString(),
        myAvailability:availability.get(a.id)??null})),
      friendlies:friendlies.flatMap(f=>{
        const involvedTeams=teamIds.filter(id=>id===f.fromTeamId||id===f.toTeamId);
        return involvedTeams.map(teamId=>({id:f.id,teamId,teamName:teamNames.get(teamId)??"",
          opponentName:teamNames.get(teamId===f.fromTeamId?f.toTeamId:f.fromTeamId)??"",
          proposedAt:f.proposedAt.toISOString(),venueName:f.venueName,status:f.status}));
      }),
    };
  }
}
export function createPlayerDashboardPhase2Router(service:PlayerDashboardPhase2Service,tokens:TokenService){
  const router=Router();
  router.get("/player-dashboard/activities",requireAuth(tokens),
    async(request:Request,response:Response,next:NextFunction)=>{
      try{response.json(await service.activities(request.auth!.userId));}catch(error){next(error);}
    });
  return router;
}
