import { randomUUID } from "node:crypto";
import {errors} from "../src/lib/errors.js";
import type {
  CompetitionDto,
  CompetitionParticipationDto,
  CompetitionDiscoveryQuery,
  CompetitionDiscoveryResponse,
  CompetitionListItemDto,
  CompetitionMatchDto,
  CompetitionPublicMatchPlayer,
  CompetitionMediaPostDto,
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
  mediaPosts = new Map<string, CompetitionMediaPostDto>();
  playerMatchStats = new Map<string,CompetitionPublicMatchPlayer[]>();
  followedCompetitions = new Map<string,Set<string>>();
  followedVenues = new Map<string,Set<string>>();
  brandAssets = new Map<string,{venueId:string;ownerUserId:string;purpose:"PROFILE"|"COVER"}>();


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
  async isVenueReferee(_venueId:string,_userId:string){return true;}
  async getCompetitionRecord(competitionId:string){return this.competitions.get(competitionId)??null;}
  async isOwnedBrandAsset(input:{venueId:string;ownerUserId:string;imageUrl:string;purpose:"PROFILE"|"COVER"}){
    const asset=this.brandAssets.get(input.imageUrl);
    return Boolean(asset&&asset.venueId===input.venueId&&asset.ownerUserId===input.ownerUserId&&asset.purpose===input.purpose);
  }

  private async dto(competitionId:string):Promise<CompetitionDto|null>{
    const row=this.competitions.get(competitionId);
    if(!row)return null;
    const registrations=[...this.registrations.values()].filter((item)=>item.competitionId===competitionId);
    const teams:CompetitionTeamDto[]=registrations.map((item)=>({
      teamId:item.teamId,teamName:item.teamName,logoUrl:item.logoUrl,status:item.status,seed:item.seed,groupId:item.groupId,groupName:item.groupName,
      feeStatus:item.feeStatus,feePaymentReference:item.feePaymentReference,feeConfirmedAt:item.feeConfirmedAt?.toISOString()??null,
    }));
    const matches=[...this.matches.values()].filter((item)=>item.competitionId===competitionId);
    const final=matches.find((item)=>item.stage==="KNOCKOUT"&&item.roundNumber===1);
    return {
      id:row.id,venueId:row.venueId,venueName:row.venueName,name:row.name,description:row.description,
      logoUrl:row.logoUrl,coverImageUrl:row.coverImageUrl,
      format:row.format,status:row.status,published:row.published,maxTeams:row.maxTeams,
      registrationFeeAfn:row.registrationFeeAfn,winPoints:row.winPoints,drawPoints:row.drawPoints,lossPoints:row.lossPoints,
      tieBreakOrder:row.tieBreakOrder,rewards:row.rewards,groupCount:row.groupCount,qualifiersPerGroup:row.qualifiersPerGroup,
      registrationClosesAt:row.registrationClosesAt?.toISOString()??null,matchDurationMinutes:row.matchDurationMinutes,
      startsAt:row.startsAt?.toISOString()??null,endsAt:row.endsAt?.toISOString()??null,
      teams,matches,standings:[],playerStats:[],championTeamId:final?.winnerTeamId??null,
    };
  }

  async getCompetitionDto(competitionId:string){return this.dto(competitionId);}
  async listPublicMatchPlayerStats(matchId:string){return this.playerMatchStats.get(matchId)??[];}

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
        logoUrl:row.logoUrl,coverImageUrl:row.coverImageUrl,
        format:row.format,status:row.status,published:row.published,maxTeams:row.maxTeams,
        registrationFeeAfn:row.registrationFeeAfn,winPoints:row.winPoints,drawPoints:row.drawPoints,lossPoints:row.lossPoints,
        tieBreakOrder:row.tieBreakOrder,groupCount:row.groupCount,qualifiersPerGroup:row.qualifiersPerGroup,
        registrationClosesAt:row.registrationClosesAt?.toISOString()??null,matchDurationMinutes:row.matchDurationMinutes,
        startsAt:row.startsAt?.toISOString()??null,endsAt:row.endsAt?.toISOString()??null,
        acceptedTeams:await this.countAcceptedTeams(row.id),
      });
    }
    return out;
  }

  async listOwnerCompetitions(ownerUserId:string){return this.items(ownerUserId,false);}
  async listPublicCompetitions(){return this.items(undefined,true);}

  async discoverPublicCompetitions(filters:CompetitionDiscoveryQuery,userId?:string):Promise<CompetitionDiscoveryResponse>{
    const publicItems=(await this.items(undefined,true)).filter(x=>
      x.status!=="DRAFT"&&x.status!=="CANCELLED");
    const provinces=["Kabul"];
    const cities=["Kabul"];
    const q=filters.q.toLocaleLowerCase();
    let found=publicItems.filter(item=>{
      const involved=[...this.registrations.values()].some(reg=>
        reg.competitionId===item.id&&this.teams.get(reg.teamId)?.managerUserId===userId);
      const isFollowed=Boolean(userId&&this.followedCompetitions.get(userId)?.has(item.id));
      const venueFollowed=Boolean(userId&&this.followedVenues.get(userId)?.has(item.venueId));
      return (!filters.province||filters.province==="Kabul")&&
        (!filters.city||filters.city==="Kabul")&&
        (!filters.status||filters.status===item.status)&&
        (!filters.format||filters.format===item.format)&&
        (filters.fee!=="free"||item.registrationFeeAfn===0)&&
        (filters.fee!=="paid"||item.registrationFeeAfn>0)&&
        (filters.minFee===undefined||item.registrationFeeAfn>=filters.minFee)&&
        (filters.maxFee===undefined||item.registrationFeeAfn<=filters.maxFee)&&
        (!filters.from||Boolean(item.startsAt&&item.startsAt.slice(0,10)>=filters.from))&&
        (!filters.to||Boolean(item.startsAt&&item.startsAt.slice(0,10)<=filters.to))&&
        (!q||[item.name,item.venueName,"Kabul"].some(value=>value.toLocaleLowerCase().includes(q)))&&
        (filters.phase==="all"||(
          filters.phase==="active"&&["REGISTRATION_OPEN","IN_PROGRESS"].includes(item.status)||
          filters.phase==="upcoming"&&["REGISTRATION_CLOSED","SCHEDULED"].includes(item.status)||
          filters.phase==="history"&&["COMPLETED","ARCHIVED"].includes(item.status)))&&
        (filters.scope!=="registration"||item.status==="REGISTRATION_OPEN")&&
        (!["ongoing","ongoingFollowedVenues"].includes(filters.scope)||item.status==="IN_PROGRESS")&&
        (filters.scope!=="following"||isFollowed)&&
        (filters.scope!=="mine"||involved)&&
        (filters.scope!=="ongoingFollowedVenues"||venueFollowed);
    });
    const followers=(item:typeof publicItems[number])=>[...this.followedCompetitions.values()]
      .filter(ids=>ids.has(item.id)).length;
    const sorted=found.sort((a,b)=>filters.sort==="popular"||filters.scope==="popular"?
      followers(b)-followers(a)||a.name.localeCompare(b.name):
      filters.sort==="feeLow"?a.registrationFeeAfn-b.registrationFeeAfn||a.id.localeCompare(b.id):
      filters.sort==="newest"?b.id.localeCompare(a.id):
      filters.sort==="closing"?(a.registrationClosesAt??"9999").localeCompare(b.registrationClosesAt??"9999"):
      (a.startsAt??"9999").localeCompare(b.startsAt??"9999")||a.name.localeCompare(b.name));
    const total=sorted.length;
    found=sorted.slice((filters.page-1)*filters.limit,filters.page*filters.limit);
    return {
      competitions:found.map(item=>({...item,coverImageUrl:null,province:"Kabul",city:"Kabul",
        followerCount:followers(item)})),
      total,page:filters.page,limit:filters.limit,hasMore:filters.page*filters.limit<total,
      facets:{provinces,cities:filters.province&&filters.province!=="Kabul"?[]:cities},
    };
  }

  async listMyPublicCompetitions(userId:string):Promise<CompetitionListItemDto[]>{
    // Like production: both managers without membership rows and ACTIVE members
    // can see competitions involving an ACTIVE team.
    const teamIds=new Set([...this.teams.values()].filter(team=>
      team.status==="ACTIVE"&&(team.managerUserId===userId||
        this.activeMemberships.get(userId)?.has(team.id))).map(team=>team.id));
    const involved=new Set([...this.registrations.values()].filter(item=>
      teamIds.has(item.teamId)).map(item=>item.competitionId));
    return (await this.items(undefined,true)).filter(item=>involved.has(item.id));
  }


  /** Fake fixture models managers as participating users; tests may seed additional active memberships. */
  activeMemberships=new Map<string,Set<string>>();
  async listMyCompetitionParticipations(userId:string,competitionId?:string):Promise<CompetitionParticipationDto[]>{
    return [...this.registrations.values()].filter(reg=>{
      const comp=this.competitions.get(reg.competitionId),team=this.teams.get(reg.teamId);
      return comp?.published&&comp.status!=="DRAFT"&&(!competitionId||comp.id===competitionId)&&
        Boolean(team&&(team.managerUserId===userId||this.activeMemberships.get(userId)?.has(team.id)));
    }).map(reg=>{
      const team=this.teams.get(reg.teamId)!,comp=this.competitions.get(reg.competitionId)!;
      const isManager=team.managerUserId===userId;
      const mutable=["REGISTRATION_OPEN","REGISTRATION_CLOSED"].includes(comp.status);
      return {competitionId:reg.competitionId,teamId:reg.teamId,teamName:team.name,
        status:reg.status,feeStatus:reg.feeStatus,isManager,
        canRespond:isManager&&mutable&&reg.status==="INVITED",
        canWithdraw:isManager&&mutable&&["APPLIED","ACCEPTED","INVITED"].includes(reg.status)};
    });
  }
  async acceptRegistrationWithCapacity(input:Parameters<CompetitionRepository["acceptRegistrationWithCapacity"]>[0]){
    const competition=this.competitions.get(input.competitionId);
    if(!competition?.published||!["REGISTRATION_OPEN","REGISTRATION_CLOSED"].includes(competition.status))
      throw errors.conflict("REGISTRATION_CLOSED","Registration cannot be accepted.");
    const existing=this.registrations.get(this.key(input.competitionId,input.teamId));
    if(!existing||(input.kind==="INVITATION"?existing.status!=="INVITED":
      !["APPLIED","PENDING"].includes(existing.status)))
      throw errors.conflict("REGISTRATION_NOT_PENDING","Registration is not pending.");
    const team=this.teams.get(input.teamId);
    if(input.kind==="INVITATION"&&team?.managerUserId!==input.actorUserId)
      throw errors.forbidden("TEAM_MANAGER_REQUIRED","Only the manager can accept.");
    if(this.registrations.size>=0&&await this.countAcceptedTeams(input.competitionId)>=competition.maxTeams)
      throw errors.conflict("COMPETITION_FULL","This competition is full.");
    this.registrations.set(this.key(input.competitionId,input.teamId),{
      ...existing,status:"ACCEPTED",seed:input.kind==="APPROVAL"?input.seed:existing.seed,
    });
  }
  async createCompetition(input:Parameters<CompetitionRepository["createCompetition"]>[0]){
    const venue=[...this.venues.values()].find((item)=>item.id===input.venueId)!;
    const row:CompetitionRecord&{venueName:string}={
      id:randomUUID(),venueId:input.venueId,createdByUserId:input.createdByUserId,name:input.name,
      description:input.description,logoUrl:null,coverImageUrl:null,format:input.format,status:"DRAFT",published:false,publishedAt:null,maxTeams:input.maxTeams,
      registrationFeeAfn:input.registrationFeeAfn,winPoints:input.winPoints,drawPoints:input.drawPoints,lossPoints:input.lossPoints,
      tieBreakOrder:input.tieBreakOrder,groupCount:input.groupCount,qualifiersPerGroup:input.qualifiersPerGroup,
      registrationClosesAt:input.registrationClosesAt,matchDurationMinutes:input.matchDurationMinutes,
      startsAt:input.startsAt,endsAt:input.endsAt,rewards:[],materialPlayStartedAt:null,venueName:venue.name,
    };
    this.competitions.set(row.id,row);
    return (await this.dto(row.id))!;
  }

  async updateCompetition(competitionId:string,input:Parameters<CompetitionRepository["updateCompetition"]>[1]){
    const row=this.competitions.get(competitionId);
    if(!row)return null;
    const next={...row};
    for(const key of ["name","description","logoUrl","coverImageUrl","format","maxTeams","registrationFeeAfn","winPoints","drawPoints","lossPoints","tieBreakOrder","rewards","groupCount","qualifiersPerGroup","registrationClosesAt","matchDurationMinutes","startsAt","endsAt"] as const){
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
    if(input.publishedAt!==undefined)next.publishedAt=input.publishedAt;
    if(input.materialPlayStartedAt!==undefined)next.materialPlayStartedAt=input.materialPlayStartedAt;
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
    return {
      competitionId,teamId,teamName:team.name,logoUrl:team.logoUrl,managerUserId:team.managerUserId,teamPrivacy:team.privacy,offlineVenueId:null,claimedAt:null,
      status,seed,groupId:null,groupName:null,feeStatus:"UNPAID",feePaymentReference:null,feeConfirmedAt:null,
    };
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

  async removeTeamByOwner(input:Parameters<CompetitionRepository["removeTeamByOwner"]>[0]){
    this.registrations.delete(this.key(input.competitionId,input.teamId));
  }

  async deleteCompetition(competitionId:string){
    const deleted=this.competitions.delete(competitionId);
    for(const key of [...this.registrations.keys()]){
      if(key.startsWith(`${competitionId}:`))this.registrations.delete(key);
    }
    for(const [id,match] of [...this.matches]){
      if(match.competitionId===competitionId)this.matches.delete(id);
    }
    for(const [id,post] of [...this.mediaPosts]){
      if(post.competitionId===competitionId)this.mediaPosts.delete(id);
    }
    return deleted;
  }

  async updateTeamFee(input:Parameters<CompetitionRepository["updateTeamFee"]>[0]){
    const key=this.key(input.competitionId,input.teamId);
    const current=this.registrations.get(key);
    if(!current)return null;
    const next={
      ...current,
      feeStatus:input.status,
      feePaymentReference:input.paymentReference,
      feeConfirmedAt:input.status==="PAID"||input.status==="WAIVED"?input.now:null,
    };
    this.registrations.set(key,next);
    return next;
  }

  async listCompetitionMedia(competitionId:string,includeUnpublished:boolean){
    return [...this.mediaPosts.values()]
      .filter((post)=>post.competitionId===competitionId&&(includeUnpublished||post.status==="PUBLISHED"))
      .sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  }

  async createCompetitionMediaPost(input:Parameters<CompetitionRepository["createCompetitionMediaPost"]>[0]){
    const post:CompetitionMediaPostDto={
      id:randomUUID(),
      competitionId:input.competitionId,
      body:input.body,
      imageUrl:input.imageUrl,
      status:"PUBLISHED",
      publishedAt:input.now.toISOString(),
      unpublishedAt:null,
    };
    this.mediaPosts.set(post.id,post);
    return post;
  }

  async setCompetitionMediaStatus(input:Parameters<CompetitionRepository["setCompetitionMediaStatus"]>[0]){
    const current=this.mediaPosts.get(input.postId);
    if(!current||current.competitionId!==input.competitionId)return null;
    const next:CompetitionMediaPostDto={
      ...current,
      status:input.published?"PUBLISHED":"UNPUBLISHED",
      publishedAt:input.published?input.now.toISOString():current.publishedAt,
      unpublishedAt:input.published?null:input.now.toISOString(),
    };
    this.mediaPosts.set(next.id,next);
    return next;
  }

  async listCompetitionFollowerUserIds(_competitionId:string){
    return [];
  }

  async replaceGroupStage(
    competitionId:string,
    groups:Array<{
      name:string;
      sortOrder:number;
      teamIds:string[];
      fixtures:Array<{roundNumber:number;slotNumber:number;homeTeamId:string;awayTeamId:string}>;
    }>,
    _now:Date,
  ){
    for(const [id,match] of this.matches){
      if(match.competitionId===competitionId)this.matches.delete(id);
    }
    for(const group of groups){
      const groupId=randomUUID();
      for(const teamId of group.teamIds){
        const key=this.key(competitionId,teamId);
        const current=this.registrations.get(key)!;
        this.registrations.set(key,{...current,groupId,groupName:group.name});
      }
      for(const fixture of group.fixtures){
        const id=randomUUID();
        this.matches.set(id,{
          id,competitionId,groupId,groupName:group.name,stage:"GROUP",
          roundNumber:fixture.roundNumber,slotNumber:fixture.slotNumber,
          homeTeamId:fixture.homeTeamId,homeTeamName:this.teams.get(fixture.homeTeamId)?.name??null,
          awayTeamId:fixture.awayTeamId,awayTeamName:this.teams.get(fixture.awayTeamId)?.name??null,
          areaId:null,areaName:null,startsAt:null,endsAt:null,status:"UNSCHEDULED",
          homeScore:null,awayScore:null,winnerTeamId:null,nextMatchId:null,nextMatchSide:null,
          refereeUserId:null,
        });
      }
    }
  }

  async replaceKnockoutStage(
    competitionId:string,
    matches:Array<{
      key:string;roundNumber:number;slotNumber:number;homeTeamId:string|null;awayTeamId:string|null;
      nextKey:string|null;nextSide:"HOME"|"AWAY"|null;
    }>,
    _qualifiedTeamIds:string[],
    _now:Date,
  ){
    for(const [id,match] of this.matches){
      if(match.competitionId===competitionId&&match.stage==="KNOCKOUT")this.matches.delete(id);
    }
    const ids=new Map<string,string>();
    for(const plan of matches)ids.set(plan.key,randomUUID());
    for(const plan of matches){
      const id=ids.get(plan.key)!;
      this.matches.set(id,{
        id,competitionId,groupId:null,groupName:null,stage:"KNOCKOUT",
        roundNumber:plan.roundNumber,slotNumber:plan.slotNumber,
        homeTeamId:plan.homeTeamId,homeTeamName:plan.homeTeamId?this.teams.get(plan.homeTeamId)?.name??null:null,
        awayTeamId:plan.awayTeamId,awayTeamName:plan.awayTeamId?this.teams.get(plan.awayTeamId)?.name??null:null,
        areaId:null,areaName:null,startsAt:null,endsAt:null,status:"UNSCHEDULED",
        homeScore:null,awayScore:null,winnerTeamId:null,
        nextMatchId:plan.nextKey?ids.get(plan.nextKey)??null:null,
        nextMatchSide:plan.nextSide,
        refereeUserId:null,
      });
    }
  }

  async groupStageCompleted(competitionId:string){
    const rows=[...this.matches.values()].filter((item)=>item.competitionId===competitionId&&item.stage==="GROUP");
    return rows.length>0&&rows.every((item)=>item.status==="COMPLETED"||item.status==="CORRECTED");
  }

  async knockoutStarted(competitionId:string){
    return [...this.matches.values()].some((item)=>
      item.competitionId===competitionId&&item.stage==="KNOCKOUT"&&["IN_PROGRESS","COMPLETED","CORRECTED"].includes(item.status));
  }

  async knockoutCompleted(competitionId:string){
    const rows=[...this.matches.values()].filter((item)=>item.competitionId===competitionId&&item.stage==="KNOCKOUT");
    return rows.length>0&&rows.every((item)=>item.status==="COMPLETED"||item.status==="CORRECTED");
  }

  async advanceKnockoutWinner(matchId:string,winnerTeamId:string,_now:Date){
    const match=this.matches.get(matchId);
    if(!match?.nextMatchId||!match.nextMatchSide)return;
    const next=this.matches.get(match.nextMatchId);
    if(!next)return;
    this.matches.set(next.id,{
      ...next,
      ...(match.nextMatchSide==="HOME"
        ?{homeTeamId:winnerTeamId,homeTeamName:this.teams.get(winnerTeamId)?.name??null}
        :{awayTeamId:winnerTeamId,awayTeamName:this.teams.get(winnerTeamId)?.name??null}),
    });
  }

  async replaceKnockoutParticipant(matchId:string,winnerTeamId:string,now:Date){
    return this.advanceKnockoutWinner(matchId,winnerTeamId,now);
  }

  async replaceLeagueFixtures(
    competitionId:string,
    fixtures:Array<{roundNumber:number;slotNumber:number;homeTeamId:string;awayTeamId:string}>,
    _now:Date,
  ){
    for(const [id,match] of this.matches){
      if(match.competitionId===competitionId)this.matches.delete(id);
    }
    for(const fixture of fixtures){
      const id=randomUUID();
      this.matches.set(id,{
        id,
        competitionId,
        groupId:null,
        groupName:null,
        stage:"LEAGUE",
        roundNumber:fixture.roundNumber,
        slotNumber:fixture.slotNumber,
        homeTeamId:fixture.homeTeamId,
        homeTeamName:this.teams.get(fixture.homeTeamId)?.name??null,
        awayTeamId:fixture.awayTeamId,
        awayTeamName:this.teams.get(fixture.awayTeamId)?.name??null,
        areaId:null,
        areaName:null,
        startsAt:null,
        endsAt:null,
        status:"UNSCHEDULED",
        homeScore:null,
        awayScore:null,
        winnerTeamId:null,
        nextMatchId:null,
        nextMatchSide:null,
        refereeUserId:null,
      });
    }
  }

  async getMatch(matchId:string){return this.matches.get(matchId)??null;}

  async saveMatchResult(input:Parameters<CompetitionRepository["saveMatchResult"]>[0]){
    const match=this.matches.get(input.matchId);
    if(!match)throw new Error("MATCH_NOT_FOUND");
    const corrected=match.status==="COMPLETED"||match.status==="CORRECTED";
    const next:CompetitionMatchDto={
      ...match,
      status:corrected?"CORRECTED":"COMPLETED",
      homeScore:input.homeScore,
      awayScore:input.awayScore,
      winnerTeamId:input.winnerTeamId,
    };
    this.matches.set(input.matchId,next);
    return next;
  }

  async allRequiredMatchesCompleted(competitionId:string){
    const matches=[...this.matches.values()].filter((item)=>item.competitionId===competitionId);
    return matches.length>0&&matches.every((item)=>item.status==="COMPLETED"||item.status==="CORRECTED");
  }

  async scheduleMatchAtomic(input:Parameters<CompetitionRepository["scheduleMatchAtomic"]>[0]){
    const match=this.matches.get(input.matchId);
    if(!match||match.competitionId!==input.competitionId)throw new Error("MATCH_NOT_FOUND");
    this.matches.set(input.matchId,{...match,venueId:input.venueId,areaId:input.areaId,areaName:"Pitch 1",startsAt:input.startsAt.toISOString(),endsAt:input.endsAt.toISOString(),refereeUserId:input.refereeUserId,status:"SCHEDULED"} as CompetitionMatchDto & {venueId:string});
  }
}
