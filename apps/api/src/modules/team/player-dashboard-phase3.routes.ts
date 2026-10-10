import {Router,type Request,type Response,type NextFunction} from "express";
import {and,asc,eq,inArray} from "drizzle-orm";
import type {Database} from "@leaguekick/database";
import {competitionMatches,competitions,competitionTeams,playerMatchStats,
  teamCompetitionRoster,teams} from "@leaguekick/database";
import {requireAuth} from "../../middleware/auth.js";
import type {TokenService} from "../auth/token.service.js";
import type {TeamService} from "./team.service.js";
import {careerAwards,careerTotals,officialMatchResult,uniqueOfficialRecords,
  type CareerChampion,type CareerRecord} from "./player-career.js";

export class PlayerDashboardPhase3Service{
  constructor(private readonly db:Database,private readonly teamService:TeamService){}
  async career(userId:string){
    // Authenticated/self-only: never accept userId from path, query, body, or headers.
    const profile=await this.teamService.getOwnProfile(userId);
    const [matches,rosteredChampions]=await Promise.all([
      this.db.select({
        matchId:playerMatchStats.matchId,teamId:playerMatchStats.teamId,teamName:teams.name,
        competitionId:competitionMatches.competitionId,competitionName:competitions.name,
        startsAt:competitionMatches.startsAt,updatedAt:playerMatchStats.updatedAt,
        goals:playerMatchStats.goals,assists:playerMatchStats.assists,
        yellowCards:playerMatchStats.yellowCards,redCards:playerMatchStats.redCards,
        cleanSheet:playerMatchStats.cleanSheet,playerOfMatch:playerMatchStats.playerOfMatch,
        homeTeamId:competitionMatches.homeTeamId,awayTeamId:competitionMatches.awayTeamId,
        homeScore:competitionMatches.homeScore,awayScore:competitionMatches.awayScore,
      }).from(playerMatchStats)
        .innerJoin(competitionMatches,eq(playerMatchStats.matchId,competitionMatches.id))
        .innerJoin(teams,eq(playerMatchStats.teamId,teams.id))
        .innerJoin(competitions,eq(competitionMatches.competitionId,competitions.id))
        .where(and(
          eq(playerMatchStats.playerUserId,userId),eq(playerMatchStats.appeared,true),
          inArray(competitionMatches.status,["COMPLETED","CORRECTED"]),
        )).orderBy(asc(competitionMatches.startsAt)),
      this.db.select({
        competitionId:teamCompetitionRoster.competitionId,teamId:teamCompetitionRoster.teamId,
        teamName:teams.name,competitionName:competitions.name,
        status:competitions.status,championTeamId:competitionMatches.winnerTeamId,
        finalStatus:competitionMatches.status,
        registrationStatus:competitionTeams.status,
        completedAt:competitions.completedAt,endsAt:competitions.endsAt,
      }).from(teamCompetitionRoster)
        .innerJoin(competitions,eq(teamCompetitionRoster.competitionId,competitions.id))
        .innerJoin(competitionTeams,and(
          eq(competitionTeams.competitionId,teamCompetitionRoster.competitionId),
          eq(competitionTeams.teamId,teamCompetitionRoster.teamId)))
        .innerJoin(teams,eq(teamCompetitionRoster.teamId,teams.id))
        // Use the actual knockout final (round 1, slot 1) recorded by competition management.
        .innerJoin(competitionMatches,and(
          eq(competitionMatches.competitionId,teamCompetitionRoster.competitionId),
          eq(competitionMatches.stage,"KNOCKOUT"),
          eq(competitionMatches.roundNumber,1),eq(competitionMatches.slotNumber,1)))
        .where(eq(teamCompetitionRoster.userId,userId)),
    ]);
    // Do not scope history to active membership: legitimate career records survive leaving a team.
    const records:CareerRecord[]=uniqueOfficialRecords(matches.map(m=>({
      matchId:m.matchId,teamId:m.teamId,teamName:m.teamName,
      competitionId:m.competitionId,competitionName:m.competitionName,
      recordedAt:(m.startsAt??m.updatedAt).toISOString(),startsAt:m.startsAt?.toISOString()??null,
      goals:m.goals,assists:m.assists,yellowCards:m.yellowCards,redCards:m.redCards,
      cleanSheet:m.cleanSheet,playerOfMatch:m.playerOfMatch,
      homeScore:m.homeScore,awayScore:m.awayScore,
      result:officialMatchResult(m.homeTeamId,m.awayTeamId,m.teamId,m.homeScore,m.awayScore),
    })));
    const champions:CareerChampion[]=rosteredChampions
      .filter(c=>["COMPLETED","ARCHIVED"].includes(c.status)&&
        c.registrationStatus==="ACCEPTED"&&
        ["COMPLETED","CORRECTED"].includes(c.finalStatus)&&c.championTeamId===c.teamId&&
        !!(c.completedAt??c.endsAt))
      .map(c=>({competitionId:c.competitionId,teamId:c.teamId,teamName:c.teamName,
        competitionName:c.competitionName,achievedAt:(c.completedAt??c.endsAt)!.toISOString()}));
    const achievements=careerAwards(records,champions);
    const teamsList=[...new Map(records.map(m=>[m.teamId,{id:m.teamId,name:m.teamName}])).values()]
      .sort((a,b)=>a.name.localeCompare(b.name));
    const competitionList=[...new Map(records.map(m=>[m.competitionId,{
      id:m.competitionId,name:m.competitionName}])).values()]
      .sort((a,b)=>a.name.localeCompare(b.name));
    return {
      visibility:profile.visibility,
      totals:careerTotals(records),records:records.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)),
      achievements,teams:teamsList,competitions:competitionList,
    };
  }
}
export function createPlayerDashboardPhase3Router(service:PlayerDashboardPhase3Service,tokens:TokenService){
  const router=Router(),auth=requireAuth(tokens);
  router.get("/player-dashboard/career",auth,async(req:Request,res:Response,next:NextFunction)=>{
    try{res.json(await service.career(req.auth!.userId));}catch(e){next(e);}
  });
  return router;
}
