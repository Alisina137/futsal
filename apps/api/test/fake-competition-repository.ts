import { randomUUID } from "node:crypto";
import type {
  CompetitionDto,
  CompetitionListItemDto,
  CompetitionMatchDto,
  CompetitionTeamDto,
} from "@leaguekick/contracts";
import type {
  CompetitionRecord,
  CompetitionRepository,
  CompetitionTeamRecord,
  CompetitionVenueRecord,
} from "../src/modules/competition/competition.types.js";

export class FakeCompetitionRepository implements CompetitionRepository {
  venues = new Map<string, CompetitionVenueRecord>();
  competitions = new Map<string, CompetitionRecord & { venueName: string }>();
  teams = new Map<string, { id:string;name:string;managerUserId:string;status:"ACTIVE"|"ARCHIVED";logoUrl:string|null;privacy:"PUBLIC"|"PRIVATE" }>();
  registrations = new Map<string, CompetitionTeamRecord>();
  matches = new Map<string, CompetitionMatchDto>();

  seedVenue(ownerUserId:string, options?:{activeUntil?:Date|null;trialEndsAt?:Date|null;subscriptionStatus?:"TRIAL"|"ACTIVE"|"EXPIRED"|"CANCELLED";status?:CompetitionVenueRecord["status"]}) {
    const venue:CompetitionVenueRecord={
      id:randomUUID(),
      ownerUserId,
      name:"Kabul Arena",
      status:options?.status??"ACTIVE",
      areas:[{id:randomUUID(),name:"Pitch 1",active:true}],
      subscription:{
        status:options?.subscriptionStatus??"TRIAL",
        trialEndsAt:options?.trialEndsAt??new Date("2026-10-08T00:00:00.000Z"),
        activeUntil:options?.activeUntil??null,
      },
    };
    this.venues.set(ownerUserId,venue);
    return venue;
  }

  seedTeam(managerUserId:string,name:string="Team"){
    const team={id:randomUUID(),name,managerUserId,status:"ACTIVE" as const,logoUrl:null,privacy:"PUBLIC" as const};
    this.teams.set(team.id,team);
    return team;
  }

  private key(competitionId:string,teamId:string){return `${competitionId}:${teamId}`;}

  async getOwnerVenue(ownerUserId:string){return this.venues.get(ownerUserId)??null;}
  async getCompetitionRecord(competitionId:string){return this.competitions.get(competitionId)??null;}

  private async dto(competitionId:string):Promise<CompetitionDto|null>{
    const row=this.competitions.get(competitionId);
    if(!row)return null;
    const registrations=[...this.registrations.values()].filter((item)=>item.competitionId===competitionId);
    const teams:CompetitionTeamDto[]=registrations.map((item)=>({
      teamId:item.teamId,teamName:item.teamName,logoUrl:item.logoUrl,status:item.status,seed:item.seed,groupId:item.groupId,groupName:item.groupName,
    }));
    const matches=[...this.matches.values()].filter((item)=>item.competitionId===competitionId);
    const final=matches.find((item)=>item.stage==="KNOCKOUT"&&item.roundNumber===1);
    return {
      id:row.id,venueId:row.venueId,venueName:row.venueName,name:row.name,description:row.description,
      format:row.format,status:row.status,published:row.published,maxTeams:row.maxTeams,
      registrationFeeAfn:row.registrationFeeAfn,winPoints:row.winPoints,drawPoints:row.drawPoints,lossPoints:row.lossPoints,
      tieBreakOrder:row.tieBreakOrder,groupCount:row.groupCount,qualifiersPerGroup:row.qualifiersPerGroup,
      startsAt:row.startsAt?.toISOString()??null,endsAt:row.endsAt?.toISOString()??null,
      teams,matches,standings:[],playerStats:[],championTeamId:final?.winnerTeamId??null,
    };
  }

  async getCompetitionDto(competitionId:string){return this.dto(competitionId);}

  private async items(ownerUserId?:string,publicOnly=false):Promise<CompetitionListItemDto[]>{
    const out:CompetitionListItemDto[]=[];
    for(const row of this.competitions.values()){
      if(ownerUserId){
        const venue=[...this.venues.values()].find((item)=>item.id===row.venueId);
        if(venue?.ownerUserId!==ownerUserId)continue;
      }
      if(publicOnly&&!row.published)continue;
      out.push({
        id:row.id,venueId:row.venueId,venueName:row.venueName,name:row.name,description:row.description,
        format:row.format,status:row.status,published:row.published,maxTeams:row.maxTeams,
        registrationFeeAfn:row.registrationFeeAfn,winPoints:row.winPoints,drawPoints:row.drawPoints,lossPoints:row.lossPoints,
        tieBreakOrder:row.tieBreakOrder,groupCount:row.groupCount,qualifiersPerGroup:row.qualifiersPerGroup,
        startsAt:row.startsAt?.toISOString()??null,endsAt:row.endsAt?.toISOString()??null,
        acceptedTeams:await this.countAcceptedTeams(row.id),
      });
    }
    return out;
  }

  async listOwnerCompetitions(ownerUserId:string){return this.items(ownerUserId,false);}
  async listPublicCompetitions(){return this.items(undefined,true);}

  async createCompetition(input:Parameters<CompetitionRepository["createCompetition"]>[0]){
    const venue=[...this.venues.values()].find((item)=>item.id===input.venueId)!;
    const row:CompetitionRecord&{venueName:string}={
      id:randomUUID(),venueId:input.venueId,createdByUserId:input.createdByUserId,name:input.name,
      description:input.description,format:input.format,status:"DRAFT",published:false,maxTeams:input.maxTeams,
      registrationFeeAfn:input.registrationFeeAfn,winPoints:input.winPoints,drawPoints:input.drawPoints,lossPoints:input.lossPoints,
      tieBreakOrder:input.tieBreakOrder,groupCount:input.groupCount,qualifiersPerGroup:input.qualifiersPerGroup,
      startsAt:input.startsAt,endsAt:input.endsAt,materialPlayStartedAt:null,venueName:venue.name,
    };
    this.competitions.set(row.id,row);
    return (await this.dto(row.id))!;
  }

  async updateCompetition(competitionId:string,input:Parameters<CompetitionRepository["updateCompetition"]>[1]){
    const row=this.competitions.get(competitionId);
    if(!row)return null;
    const next={...row};
    for(const key of ["name","description","format","maxTeams","registrationFeeAfn","winPoints","drawPoints","lossPoints","tieBreakOrder","groupCount","qualifiersPerGroup","startsAt","endsAt"] as const){
      if(input[key]!==undefined)(next as Record<string,unknown>)[key]=input[key];
    }
    this.competitions.set(competitionId,next);
    return this.dto(competitionId);
  }

  async setCompetitionState(competitionId:string,input:Parameters<CompetitionRepository["setCompetitionState"]>[1]){
    const row=this.competitions.get(competitionId);
    if(!row)return null;
    const next={...row};
    if(input.status!==undefined)next.status=input.status;
    if(input.published!==undefined)next.published=input.published;
    this.competitions.set(competitionId,next);
    return this.dto(competitionId);
  }

  async getTeam(teamId:string){
    const team=this.teams.get(teamId);
    return team?{id:team.id,name:team.name,managerUserId:team.managerUserId,status:team.status}:null;
  }

  async getRegistration(competitionId:string,teamId:string){return this.registrations.get(this.key(competitionId,teamId))??null;}
  async listCompetitionTeams(competitionId:string){return [...this.registrations.values()].filter((item)=>item.competitionId===competitionId);}

  private registration(competitionId:string,teamId:string,status:CompetitionTeamRecord["status"],seed:number|null):CompetitionTeamRecord{
    const team=this.teams.get(teamId)!;
    return {competitionId,teamId,teamName:team.name,logoUrl:team.logoUrl,managerUserId:team.managerUserId,teamPrivacy:team.privacy,status,seed,groupId:null,groupName:null};
  }

  async applyTeam(input:Parameters<CompetitionRepository["applyTeam"]>[0]){
    this.registrations.set(this.key(input.competitionId,input.teamId),this.registration(input.competitionId,input.teamId,"APPLIED",null));
  }
  async inviteTeam(input:Parameters<CompetitionRepository["inviteTeam"]>[0]){
    this.registrations.set(this.key(input.competitionId,input.teamId),this.registration(input.competitionId,input.teamId,"INVITED",input.seed));
  }
  async decideRegistration(input:Parameters<CompetitionRepository["decideRegistration"]>[0]){
    const current=this.registrations.get(this.key(input.competitionId,input.teamId))!;
    this.registrations.set(this.key(input.competitionId,input.teamId),{...current,status:input.status,seed:input.seed});
  }
  async respondToInvitation(input:Parameters<CompetitionRepository["respondToInvitation"]>[0]){
    const current=this.registrations.get(this.key(input.competitionId,input.teamId))!;
    this.registrations.set(this.key(input.competitionId,input.teamId),{...current,status:input.status});
  }
  async withdrawTeam(input:Parameters<CompetitionRepository["withdrawTeam"]>[0]){
    const current=this.registrations.get(this.key(input.competitionId,input.teamId))!;
    this.registrations.set(this.key(input.competitionId,input.teamId),{...current,status:"WITHDRAWN"});
  }
  async countAcceptedTeams(competitionId:string){
    return [...this.registrations.values()].filter((item)=>item.competitionId===competitionId&&item.status==="ACCEPTED").length;
  }
  async hasCompletedMatch(competitionId:string){
    return [...this.matches.values()].some((item)=>item.competitionId===competitionId&&["COMPLETED","CORRECTED"].includes(item.status));
  }
  async scheduleMatchAtomic(input:Parameters<CompetitionRepository["scheduleMatchAtomic"]>[0]){
    const match=this.matches.get(input.matchId);
    if(!match||match.competitionId!==input.competitionId)throw new Error("MATCH_NOT_FOUND");
    this.matches.set(input.matchId,{...match,venueId:input.venueId,areaId:input.areaId,areaName:"Pitch 1",startsAt:input.startsAt.toISOString(),endsAt:input.endsAt.toISOString(),status:"SCHEDULED"} as CompetitionMatchDto & {venueId:string});
  }
}
