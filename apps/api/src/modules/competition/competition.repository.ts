import type {
  CompetitionDto,
  CompetitionParticipationDto,
  CompetitionDiscoveryQuery,
  CompetitionDiscoveryResponse,
  CompetitionRewardDto,
  CompetitionListItemDto,
  CompetitionMatchDto,
  CompetitionPublicMatchPlayer,
  CompetitionMediaPostDto,
  CompetitionTeamDto,
} from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import {
  auditLogs,
  bookings,
  competitionGroups,
  competitionMatches,
  competitions,
  competitionTeams,
  playerMatchStats,
  refereeMatchResponses,refereeMatchReports,
  playerProfiles,
  socialFollows,
  socialPosts,
  teamMemberships,
  teams,
  users,
  venueAreas,
  venueBlocks,
  venueReferees,
  venueSubscriptions,
  venues,
  venueMediaAssets,
} from "@leaguekick/database";
import { and, asc, count, desc, eq, exists, gt, gte, ilike, inArray, isNotNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { errors } from "../../lib/errors.js";
import type {
  CompetitionRecord,
  CompetitionRepository,
  CompetitionTeamRecord,
  CompetitionVenueRecord,
} from "./competition.types.js";

function toRecord(row: typeof competitions.$inferSelect): CompetitionRecord {
  return {
    id: row.id,
    venueId: row.venueId,
    createdByUserId: row.createdByUserId,
    name: row.name,
    description: row.description,
    logoUrl: row.logoUrl,
    coverImageUrl: row.coverImageUrl,
    format: row.format,
    status: row.status,
    published: row.published,
    publishedAt: row.publishedAt,
    maxTeams: row.maxTeams,
    registrationFeeAfn: row.registrationFeeAfn,
    winPoints: row.winPoints,
    drawPoints: row.drawPoints,
    lossPoints: row.lossPoints,
    tieBreakOrder: row.tieBreakOrder as CompetitionRecord["tieBreakOrder"],
    rewards:row.rewards as CompetitionRewardDto[],
    groupCount: row.groupCount,
    qualifiersPerGroup: row.qualifiersPerGroup,
    registrationClosesAt: row.registrationClosesAt,
    matchDurationMinutes: row.matchDurationMinutes,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    materialPlayStartedAt: row.materialPlayStartedAt,
  };
}

export class DrizzleCompetitionRepository implements CompetitionRepository {
  constructor(private readonly db: Database) {}

  async isOwnedBrandAsset(input:{venueId:string;ownerUserId:string;imageUrl:string;purpose:"PROFILE"|"COVER"}):Promise<boolean>{
    const match=/^\/api\/v1\/media-assets\/([0-9a-f-]{36})\/([A-Za-z0-9_-]{32,64})$/.exec(input.imageUrl);
    if(!match)return false;
    const [asset]=await this.db.select({id:venueMediaAssets.id}).from(venueMediaAssets)
      .where(and(eq(venueMediaAssets.id,match[1]!),eq(venueMediaAssets.publicToken,match[2]!),
        eq(venueMediaAssets.venueId,input.venueId),eq(venueMediaAssets.ownerUserId,input.ownerUserId),
        eq(venueMediaAssets.purpose,input.purpose))).limit(1);
    return Boolean(asset);
  }

  async getOwnerVenue(ownerUserId: string): Promise<CompetitionVenueRecord | null> {
    const [venue] = await this.db.select().from(venues)
      .where(eq(venues.ownerUserId, ownerUserId))
      .limit(1);
    if (!venue) return null;

    const [areas, subscriptionRows] = await Promise.all([
      this.db.select({
        id: venueAreas.id,
        name: venueAreas.name,
        active: venueAreas.active,
      }).from(venueAreas).where(eq(venueAreas.venueId, venue.id)),
      this.db.select().from(venueSubscriptions)
        .where(eq(venueSubscriptions.venueId, venue.id))
        .limit(1),
    ]);

    const subscription = subscriptionRows[0];
    return {
      id: venue.id,
      ownerUserId: venue.ownerUserId,
      name: venue.name,
      status: venue.status,
      areas,
      subscription: subscription ? {
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt,
        activeUntil: subscription.activeUntil,
      } : null,
    };
  }

  async isVenueReferee(venueId: string, userId: string) {
    const [row] = await this.db.select({ userId: venueReferees.userId })
      .from(venueReferees)
      .innerJoin(users, eq(venueReferees.userId, users.id))
      .where(and(
        eq(venueReferees.venueId, venueId),
        eq(venueReferees.userId, userId),
        eq(users.status, "ACTIVE"),
      ))
      .limit(1);
    return Boolean(row);
  }

  async getCompetitionRecord(competitionId: string) {
    const [row] = await this.db.select().from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async listCompetitionTeams(competitionId: string): Promise<CompetitionTeamRecord[]> {
    const rows = await this.db.select({
      competitionId: competitionTeams.competitionId,
      teamId: competitionTeams.teamId,
      teamName: teams.name,
      logoUrl: teams.logoUrl,
      managerUserId: teams.managerUserId,
      teamPrivacy: teams.privacy,
      offlineVenueId: teams.offlineVenueId,
      claimedAt: teams.claimedAt,
      status: competitionTeams.status,
      seed: competitionTeams.seed,
      groupId: competitionTeams.groupId,
      groupName: competitionGroups.name,
      feeStatus: competitionTeams.feeStatus,
      feePaymentReference: competitionTeams.feePaymentReference,
      feeConfirmedAt: competitionTeams.feeConfirmedAt,
    }).from(competitionTeams)
      .innerJoin(teams, eq(competitionTeams.teamId, teams.id))
      .leftJoin(competitionGroups, eq(competitionTeams.groupId, competitionGroups.id))
      .where(eq(competitionTeams.competitionId, competitionId));

    return rows;
  }

  private async listMatchDtos(competitionId: string): Promise<CompetitionMatchDto[]> {
    const rows = await this.db.select({
      match: competitionMatches,
      groupName: competitionGroups.name,
      areaName: venueAreas.name,
    }).from(competitionMatches)
      .leftJoin(competitionGroups, eq(competitionMatches.groupId, competitionGroups.id))
      .leftJoin(venueAreas, eq(competitionMatches.areaId, venueAreas.id))
      .where(eq(competitionMatches.competitionId, competitionId));

    const teamRows = await this.db.select({
      id: teams.id,
      name: teams.name,
    }).from(competitionTeams)
      .innerJoin(teams, eq(competitionTeams.teamId, teams.id))
      .where(eq(competitionTeams.competitionId, competitionId));
    const teamNames = new Map(teamRows.map((row) => [row.id, row.name]));

    return rows.map(({ match, groupName, areaName }) => ({
      id: match.id,
      competitionId: match.competitionId,
      groupId: match.groupId,
      groupName: groupName ?? null,
      stage: match.stage,
      roundNumber: match.roundNumber,
      slotNumber: match.slotNumber,
      homeTeamId: match.homeTeamId,
      homeTeamName: match.homeTeamId ? teamNames.get(match.homeTeamId) ?? null : null,
      awayTeamId: match.awayTeamId,
      awayTeamName: match.awayTeamId ? teamNames.get(match.awayTeamId) ?? null : null,
      areaId: match.areaId,
      areaName: areaName ?? null,
      startsAt: match.startsAt?.toISOString() ?? null,
      endsAt: match.endsAt?.toISOString() ?? null,
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      winnerTeamId: match.winnerTeamId,
      nextMatchId: match.nextMatchId,
      nextMatchSide: match.nextMatchSide === "HOME" || match.nextMatchSide === "AWAY" ? match.nextMatchSide : null,
      refereeUserId: match.refereeUserId,
    }));
  }

  private async listPlayerStats(competitionId: string): Promise<CompetitionDto["playerStats"]> {
    const rows = await this.db.select({
      playerUserId: playerMatchStats.playerUserId,
      publicDisplayName: playerProfiles.publicDisplayName,
      fallbackName: users.displayName,
      teamId: playerMatchStats.teamId,
      teamName: teams.name,
      appearances: sql<number>`sum(case when ${playerMatchStats.appeared} then 1 else 0 end)`,
      goals: sql<number>`sum(${playerMatchStats.goals})`,
      assists: sql<number>`sum(${playerMatchStats.assists})`,
      yellowCards: sql<number>`sum(${playerMatchStats.yellowCards})`,
      redCards: sql<number>`sum(${playerMatchStats.redCards})`,
      cleanSheets: sql<number>`sum(case when ${playerMatchStats.cleanSheet} then 1 else 0 end)`,
      playerOfMatchAwards: sql<number>`sum(case when ${playerMatchStats.playerOfMatch} then 1 else 0 end)`,
    }).from(playerMatchStats)
      .innerJoin(competitionMatches, eq(playerMatchStats.matchId, competitionMatches.id))
      .innerJoin(users, eq(playerMatchStats.playerUserId, users.id))
      .leftJoin(playerProfiles, eq(playerMatchStats.playerUserId, playerProfiles.userId))
      .innerJoin(teams, eq(playerMatchStats.teamId, teams.id))
      // Only finalized official results contribute to public leaderboards.
      // Draft/live/postponed fixtures cannot expose unverified player figures.
      .where(and(
        eq(competitionMatches.competitionId, competitionId),
        inArray(competitionMatches.status, ["COMPLETED", "CORRECTED"]),
      ))
      .groupBy(
        playerMatchStats.playerUserId,
        playerProfiles.publicDisplayName,
        users.displayName,
        playerMatchStats.teamId,
        teams.name,
      );

    return rows.map((row) => ({
      playerUserId: row.playerUserId,
      publicDisplayName: row.publicDisplayName ?? row.fallbackName,
      teamId: row.teamId,
      teamName: row.teamName,
      appearances: Number(row.appearances ?? 0),
      goals: Number(row.goals ?? 0),
      assists: Number(row.assists ?? 0),
      yellowCards: Number(row.yellowCards ?? 0),
      redCards: Number(row.redCards ?? 0),
      cleanSheets: Number(row.cleanSheets ?? 0),
      playerOfMatchAwards: Number(row.playerOfMatchAwards ?? 0),
    }));
  }

  async getCompetitionDto(competitionId: string): Promise<CompetitionDto | null> {
    const [row] = await this.db.select({
      competition: competitions,
      venueName: venues.name,
    }).from(competitions)
      .innerJoin(venues, eq(competitions.venueId, venues.id))
      .where(eq(competitions.id, competitionId))
      .limit(1);
    if (!row) return null;

    const [teamRows, matches, playerStats] = await Promise.all([
      this.listCompetitionTeams(competitionId),
      this.listMatchDtos(competitionId),
      this.listPlayerStats(competitionId),
    ]);

    const teamsDto: CompetitionTeamDto[] = teamRows.map((team) => ({
      teamId: team.teamId,
      offline: Boolean(team.offlineVenueId && !team.claimedAt),
      teamName: team.teamName,
      logoUrl: team.logoUrl,
      status: team.status,
      seed: team.seed,
      groupId: team.groupId,
      groupName: team.groupName,
      feeStatus: team.feeStatus,
      feePaymentReference: team.feePaymentReference,
      feeConfirmedAt: team.feeConfirmedAt?.toISOString() ?? null,
    }));

    const finalMatch = matches
      .filter((match) => match.stage === "KNOCKOUT" && match.roundNumber === 1)
      .sort((a, b) => a.slotNumber - b.slotNumber)[0];

    return {
      id: row.competition.id,
      venueId: row.competition.venueId,
      venueName: row.venueName,
      name: row.competition.name,
      description: row.competition.description,
      logoUrl:row.competition.logoUrl,
      coverImageUrl:row.competition.coverImageUrl,
      format: row.competition.format,
      status: row.competition.status,
      published: row.competition.published,
      maxTeams: row.competition.maxTeams,
      registrationFeeAfn: row.competition.registrationFeeAfn,
      winPoints: row.competition.winPoints,
      drawPoints: row.competition.drawPoints,
      lossPoints: row.competition.lossPoints,
      tieBreakOrder: row.competition.tieBreakOrder as CompetitionDto["tieBreakOrder"],
      rewards:row.competition.rewards,
      groupCount: row.competition.groupCount,
      qualifiersPerGroup: row.competition.qualifiersPerGroup,
      registrationClosesAt: row.competition.registrationClosesAt?.toISOString() ?? null,
      matchDurationMinutes: row.competition.matchDurationMinutes,
      startsAt: row.competition.startsAt?.toISOString() ?? null,
      endsAt: row.competition.endsAt?.toISOString() ?? null,
      teams: teamsDto,
      matches,
      standings: [],
      playerStats,
      championTeamId: finalMatch?.winnerTeamId ?? null,
    };
  }

  private async listItems(where: SQL): Promise<CompetitionListItemDto[]> {
    const rows = await this.db.select({
      competition: competitions,
      venueName: venues.name,
    }).from(competitions)
      .innerJoin(venues, eq(competitions.venueId, venues.id))
      .where(where);

    // Fetch one image per competition from genuine published photo posts.
    // A single bounded-by-competition-ID query avoids N+1 media requests.
    const images=new Map<string,string>();
    const acceptedCounts=new Map<string,number>();
    if(rows.length){
      const ids=rows.map(row=>row.competition.id);
      // One SQL query for all registration totals instead of one per competition.
      // Do not fetch entire media histories just to display each competition's latest photo.
      const [counts,media]=await Promise.all([
        this.db.select({id:competitionTeams.competitionId,total:sql<number>`count(*)::int`})
          .from(competitionTeams).where(and(eq(competitionTeams.status,"ACCEPTED"),
            inArray(competitionTeams.competitionId,ids))).groupBy(competitionTeams.competitionId),
        this.db.selectDistinctOn([socialPosts.entityId],
          {id:socialPosts.entityId,imageUrl:socialPosts.imageUrl}).from(socialPosts)
          .where(and(eq(socialPosts.entityType,"COMPETITION"),
            eq(socialPosts.status,"PUBLISHED"),eq(socialPosts.visibility,"PUBLIC"),
            isNotNull(socialPosts.imageUrl),inArray(socialPosts.entityId,ids)))
          .orderBy(socialPosts.entityId,desc(socialPosts.publishedAt),desc(socialPosts.id)),
      ]);
      for(const countRow of counts)acceptedCounts.set(countRow.id,Number(countRow.total));
      for(const post of media)if(post.imageUrl)images.set(post.id,post.imageUrl);
    }
    const items: CompetitionListItemDto[] = [];
    for (const row of rows) {
      items.push({
        id: row.competition.id,
        venueId: row.competition.venueId,
        venueName: row.venueName,
        name: row.competition.name,
        description: row.competition.description,
        logoUrl:row.competition.logoUrl,
        format: row.competition.format,
        status: row.competition.status,
        published: row.competition.published,
        maxTeams: row.competition.maxTeams,
        registrationFeeAfn: row.competition.registrationFeeAfn,
        winPoints: row.competition.winPoints,
        drawPoints: row.competition.drawPoints,
        lossPoints: row.competition.lossPoints,
        tieBreakOrder: row.competition.tieBreakOrder as CompetitionListItemDto["tieBreakOrder"],
        groupCount: row.competition.groupCount,
        qualifiersPerGroup: row.competition.qualifiersPerGroup,
        registrationClosesAt: row.competition.registrationClosesAt?.toISOString() ?? null,
        matchDurationMinutes: row.competition.matchDurationMinutes,
        startsAt: row.competition.startsAt?.toISOString() ?? null,
        endsAt: row.competition.endsAt?.toISOString() ?? null,
        acceptedTeams: acceptedCounts.get(row.competition.id)??0,
        coverImageUrl: row.competition.coverImageUrl??images.get(row.competition.id)??null,
      });
    }
    return items.sort((a, b) => (a.startsAt ?? a.name).localeCompare(b.startsAt ?? b.name));
  }

  async listOwnerCompetitions(ownerUserId: string) {
    return this.listItems(eq(venues.ownerUserId, ownerUserId));
  }

  async listPublicCompetitions() {
    return this.listItems(eq(competitions.published, true));
  }

  /** Only published competitions involving the authenticated user's active team membership. */
  async listMyPublicCompetitions(userId:string):Promise<CompetitionListItemDto[]>{
    // Team managers are not required to hold a separate ACTIVE team_memberships
    // row. Include their teams, or active members, without duplicating competitions.
    const links=await this.db.selectDistinct({competitionId:competitionTeams.competitionId})
      .from(competitionTeams)
      .innerJoin(teams,eq(teams.id,competitionTeams.teamId))
      .leftJoin(teamMemberships,and(eq(teamMemberships.teamId,teams.id),
        eq(teamMemberships.userId,userId),eq(teamMemberships.status,"ACTIVE")))
      .innerJoin(competitions,eq(competitions.id,competitionTeams.competitionId))
      .where(and(eq(competitions.published,true),eq(teams.status,"ACTIVE"),
        or(eq(teams.managerUserId,userId),isNotNull(teamMemberships.userId))));
    if(!links.length)return [];
    return this.listItems(and(eq(competitions.published,true),
      inArray(competitions.id,links.map(link=>link.competitionId)))!);
  }


  async discoverPublicCompetitions(filters:CompetitionDiscoveryQuery,userId?:string):Promise<CompetitionDiscoveryResponse>{
    // Restrict every discovery query BEFORE pagination, including count and facets.
    const constraints:SQL[]=[
      eq(competitions.published,true),
      ne(competitions.status,"DRAFT"),
      ne(competitions.status,"CANCELLED"),
    ];
    if(filters.province)constraints.push(eq(venues.province,filters.province));
    if(filters.city)constraints.push(eq(venues.city,filters.city));
    if(filters.status)constraints.push(eq(competitions.status,filters.status));
    if(filters.format)constraints.push(eq(competitions.format,filters.format));
    if(filters.fee==="free")constraints.push(eq(competitions.registrationFeeAfn,0));
    if(filters.fee==="paid")constraints.push(gt(competitions.registrationFeeAfn,0));
    if(filters.minFee!==undefined)constraints.push(gte(competitions.registrationFeeAfn,filters.minFee));
    if(filters.maxFee!==undefined)constraints.push(lte(competitions.registrationFeeAfn,filters.maxFee));
    if(filters.from)constraints.push(gte(competitions.startsAt,new Date(filters.from+"T00:00:00+04:30")));
    if(filters.to){
      const end=new Date(Date.parse(filters.to+"T00:00:00+04:30")+86_400_000);
      constraints.push(lt(competitions.startsAt,end));
    }
    if(filters.q){
      const literal="%"+filters.q.replace(/[\\%_]/g,"\\$&")+"%";
      constraints.push(or(ilike(competitions.name,literal),ilike(venues.name,literal),
        ilike(venues.province,literal),ilike(venues.city,literal))!);
    }
    if(filters.phase==="active")constraints.push(inArray(competitions.status,
      ["REGISTRATION_OPEN","IN_PROGRESS"]));
    if(filters.phase==="upcoming")constraints.push(inArray(competitions.status,
      ["REGISTRATION_CLOSED","SCHEDULED"]));
    if(filters.phase==="history")constraints.push(inArray(competitions.status,
      ["COMPLETED","ARCHIVED"]));
    if(filters.scope==="registration")constraints.push(eq(competitions.status,"REGISTRATION_OPEN"));
    if(filters.scope==="ongoing"||filters.scope==="ongoingFollowedVenues")
      constraints.push(eq(competitions.status,"IN_PROGRESS"));
    if(filters.scope==="following"&&userId)constraints.push(exists(this.db
      .select({id:socialFollows.entityId}).from(socialFollows)
      .where(and(eq(socialFollows.userId,userId),eq(socialFollows.entityType,"COMPETITION"),
        eq(socialFollows.entityId,competitions.id)))));
    if(filters.scope==="mine"&&userId)constraints.push(exists(this.db
      .select({id:competitionTeams.competitionId}).from(competitionTeams)
      .innerJoin(teams,eq(teams.id,competitionTeams.teamId))
      .leftJoin(teamMemberships,and(eq(teamMemberships.teamId,teams.id),
        eq(teamMemberships.userId,userId),eq(teamMemberships.status,"ACTIVE")))
      .where(and(eq(competitionTeams.competitionId,competitions.id),
        or(eq(teams.managerUserId,userId),isNotNull(teamMemberships.userId))))));
    if(filters.scope==="ongoingFollowedVenues"&&userId)constraints.push(exists(this.db
      .select({id:socialFollows.entityId}).from(socialFollows)
      .where(and(eq(socialFollows.userId,userId),eq(socialFollows.entityType,"VENUE"),
        eq(socialFollows.entityId,competitions.venueId)))));
    const where=and(...constraints)!;
    const acceptedCounts=this.db.select({
      competitionId:competitionTeams.competitionId,
      total:sql<number>`count(*)::int`.as("accepted_total"),
    }).from(competitionTeams).where(eq(competitionTeams.status,"ACCEPTED"))
      .groupBy(competitionTeams.competitionId).as("competition_discovery_accepted");
    const followCounts=this.db.select({
      competitionId:socialFollows.entityId,
      total:sql<number>`count(*)::int`.as("follower_total"),
    }).from(socialFollows).where(eq(socialFollows.entityType,"COMPETITION"))
      .groupBy(socialFollows.entityId).as("competition_discovery_follows");
    const follows=sql<number>`coalesce(${followCounts.total},0)`;
    const starts=sql`coalesce(${competitions.startsAt}, 'infinity'::timestamptz)`;
    const closing=sql`coalesce(${competitions.registrationClosesAt},'infinity'::timestamptz)`;
    const sort=filters.scope==="popular"?"popular":filters.sort;
    const order=sort==="popular"?[desc(follows),asc(competitions.name),asc(competitions.id)]:
      sort==="starting"?[asc(starts),asc(competitions.id)]:
      sort==="newest"?[desc(competitions.createdAt),asc(competitions.id)]:
      sort==="closing"?[asc(closing),asc(competitions.id)]:
      sort==="feeLow"?[asc(competitions.registrationFeeAfn),asc(starts),asc(competitions.id)]:
      [asc(sql`case when ${competitions.status}='IN_PROGRESS' then 0
        when ${competitions.status}='REGISTRATION_OPEN' then 1
        when ${competitions.status}='SCHEDULED' then 2 else 3 end`),
        asc(starts),desc(follows),asc(competitions.id)];
    const base=()=>this.db.select({
      competition:competitions,venueName:venues.name,province:venues.province,city:venues.city,
      accepted:sql<number>`coalesce(${acceptedCounts.total},0)`,
      followerCount:follows,
    }).from(competitions).innerJoin(venues,eq(competitions.venueId,venues.id))
      .leftJoin(acceptedCounts,eq(acceptedCounts.competitionId,competitions.id))
      .leftJoin(followCounts,eq(followCounts.competitionId,competitions.id));
    const facetBase=and(eq(competitions.published,true),ne(competitions.status,"DRAFT"),
      ne(competitions.status,"CANCELLED"))!;
    const [rows,totalRows,provinces,cities]=await Promise.all([
      base().where(where).orderBy(...order)
        .limit(filters.limit).offset((filters.page-1)*filters.limit),
      this.db.select({total:sql<number>`count(*)::int`}).from(competitions)
        .innerJoin(venues,eq(competitions.venueId,venues.id)).where(where),
      this.db.selectDistinct({value:venues.province}).from(competitions)
        .innerJoin(venues,eq(competitions.venueId,venues.id))
        .where(facetBase).orderBy(asc(venues.province)).limit(200),
      this.db.selectDistinct({value:venues.city}).from(competitions)
        .innerJoin(venues,eq(competitions.venueId,venues.id))
        .where(and(facetBase,filters.province?eq(venues.province,filters.province):undefined))
        .orderBy(asc(venues.city)).limit(500),
    ]);
    const images=new Map<string,string>();
    if(rows.length){
      const media=await this.db.selectDistinctOn([socialPosts.entityId],
        {id:socialPosts.entityId,imageUrl:socialPosts.imageUrl}).from(socialPosts)
        .where(and(eq(socialPosts.entityType,"COMPETITION"),
          eq(socialPosts.status,"PUBLISHED"),eq(socialPosts.visibility,"PUBLIC"),
          isNotNull(socialPosts.imageUrl),
          inArray(socialPosts.entityId,rows.map(row=>row.competition.id))))
        .orderBy(socialPosts.entityId,desc(socialPosts.publishedAt),desc(socialPosts.id));
      for(const post of media)if(post.imageUrl)images.set(post.id,post.imageUrl);
    }
    const total=Number(totalRows[0]?.total??0);
    return {
      competitions:rows.map(row=>({
        id:row.competition.id,venueId:row.competition.venueId,venueName:row.venueName,
        name:row.competition.name,description:row.competition.description,
        logoUrl:row.competition.logoUrl,
        format:row.competition.format,status:row.competition.status,
        published:row.competition.published,maxTeams:row.competition.maxTeams,
        registrationFeeAfn:row.competition.registrationFeeAfn,
        winPoints:row.competition.winPoints,drawPoints:row.competition.drawPoints,
        lossPoints:row.competition.lossPoints,
        tieBreakOrder:row.competition.tieBreakOrder as CompetitionDiscoveryResponse["competitions"][number]["tieBreakOrder"],
        groupCount:row.competition.groupCount,qualifiersPerGroup:row.competition.qualifiersPerGroup,
        registrationClosesAt:row.competition.registrationClosesAt?.toISOString()??null,
        matchDurationMinutes:row.competition.matchDurationMinutes,
        startsAt:row.competition.startsAt?.toISOString()??null,
        endsAt:row.competition.endsAt?.toISOString()??null,
        acceptedTeams:Number(row.accepted),coverImageUrl:row.competition.coverImageUrl??images.get(row.competition.id)??null,
        province:row.province,city:row.city,followerCount:Number(row.followerCount),
      })),
      total,page:filters.page,limit:filters.limit,hasMore:filters.page*filters.limit<total,
      facets:{provinces:provinces.map(item=>item.value),cities:cities.map(item=>item.value)},
    };
  }


  async listMyCompetitionParticipations(userId:string,competitionId?:string):Promise<CompetitionParticipationDto[]>{
    // Query ONLY team memberships of the authenticated caller and teams they manage.
    // Joining the matching active membership rather than filtering in JS avoids data leaks.
    const rows=await this.db.select({
      competitionId:competitionTeams.competitionId,teamId:competitionTeams.teamId,
      teamName:teams.name,status:competitionTeams.status,feeStatus:competitionTeams.feeStatus,
      managerUserId:teams.managerUserId,memberId:teamMemberships.userId,
      competitionStatus:competitions.status,
    }).from(competitionTeams)
      .innerJoin(teams,eq(teams.id,competitionTeams.teamId))
      .innerJoin(competitions,eq(competitions.id,competitionTeams.competitionId))
      .leftJoin(teamMemberships,and(eq(teamMemberships.teamId,teams.id),
        eq(teamMemberships.userId,userId),eq(teamMemberships.status,"ACTIVE")))
      .where(and(eq(competitions.published,true),ne(competitions.status,"DRAFT"),
        or(eq(teams.managerUserId,userId),isNotNull(teamMemberships.userId)),
        competitionId?eq(competitions.id,competitionId):undefined))
      .orderBy(desc(competitionTeams.updatedAt));
    return rows.map(row=>{
      const isManager=row.managerUserId===userId;
      const mutable=["REGISTRATION_OPEN","REGISTRATION_CLOSED"].includes(row.competitionStatus);
      return {
        competitionId:row.competitionId,teamId:row.teamId,teamName:row.teamName,
        status:row.status,feeStatus:row.feeStatus,isManager,
        canRespond:isManager&&mutable&&row.status==="INVITED",
        canWithdraw:isManager&&mutable&&["INVITED","APPLIED","ACCEPTED"].includes(row.status),
      };
    });
  }

  async acceptRegistrationWithCapacity(input:Parameters<CompetitionRepository["acceptRegistrationWithCapacity"]>[0]){
    await this.db.transaction(async tx=>{
      // PostgreSQL row lock serializes concurrent organizer approvals and invitation
      // acceptances so both requests cannot take the same final team slot.
      const [competition]=await tx.select({status:competitions.status,published:competitions.published,
        maxTeams:competitions.maxTeams,venueId:competitions.venueId})
        .from(competitions).where(eq(competitions.id,input.competitionId))
        .for("update").limit(1);
      if(!competition||!competition.published||
        !["REGISTRATION_OPEN","REGISTRATION_CLOSED"].includes(competition.status))
        throw errors.conflict("REGISTRATION_CLOSED","Registration can no longer be accepted.");
      const [registration]=await tx.select({status:competitionTeams.status})
        .from(competitionTeams).where(and(eq(competitionTeams.competitionId,input.competitionId),
          eq(competitionTeams.teamId,input.teamId))).limit(1);
      if(!registration||(input.kind==="INVITATION"?registration.status!=="INVITED":
        !["APPLIED","PENDING"].includes(registration.status)))
        throw errors.conflict("REGISTRATION_NOT_PENDING","The registration is no longer awaiting this decision.");
      if(input.kind==="INVITATION"){
        const [team]=await tx.select({managerUserId:teams.managerUserId,status:teams.status})
          .from(teams).where(eq(teams.id,input.teamId)).limit(1);
        if(!team||team.status!=="ACTIVE"||team.managerUserId!==input.actorUserId)
          throw errors.forbidden("TEAM_MANAGER_REQUIRED","Only the active team manager can accept.");
      }else{
        const [venue]=await tx.select({ownerUserId:venues.ownerUserId})
          .from(venues).where(eq(venues.id,competition.venueId)).limit(1);
        if(!venue||venue.ownerUserId!==input.actorUserId)
          throw errors.forbidden("VENUE_OWNER_REQUIRED","Only this competition's organizer may accept.");
      }
      const [accepted]=await tx.select({value:count()}).from(competitionTeams)
        .where(and(eq(competitionTeams.competitionId,input.competitionId),
          eq(competitionTeams.status,"ACCEPTED")));
      if(Number(accepted?.value??0)>=competition.maxTeams)
        throw errors.conflict("COMPETITION_FULL","This competition has reached its team capacity.");
      await tx.update(competitionTeams).set({
        status:"ACCEPTED",
        ...(input.kind==="APPROVAL"?{seed:input.seed}:{ }),
        respondedByUserId:input.actorUserId,respondedAt:input.now,updatedAt:input.now,
      }).where(and(eq(competitionTeams.competitionId,input.competitionId),
        eq(competitionTeams.teamId,input.teamId)));
    });
  }

  async createCompetition(input: Parameters<CompetitionRepository["createCompetition"]>[0]) {
    const [created] = await this.db.insert(competitions).values({
      venueId: input.venueId,
      createdByUserId: input.createdByUserId,
      name: input.name,
      description: input.description,
      format: input.format,
      status: "DRAFT",
      published: false,
      maxTeams: input.maxTeams,
      registrationFeeAfn: input.registrationFeeAfn,
      winPoints: input.winPoints,
      drawPoints: input.drawPoints,
      lossPoints: input.lossPoints,
      tieBreakOrder: input.tieBreakOrder,
      groupCount: input.groupCount,
      qualifiersPerGroup: input.qualifiersPerGroup,
      registrationClosesAt: input.registrationClosesAt,
      matchDurationMinutes: input.matchDurationMinutes,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      createdAt: input.now,
      updatedAt: input.now,
    }).returning({ id: competitions.id });
    if (!created) throw new Error("Competition could not be created.");
    return (await this.getCompetitionDto(created.id))!;
  }

  async updateCompetition(competitionId: string, input: Parameters<CompetitionRepository["updateCompetition"]>[1]) {
    const patch: Partial<typeof competitions.$inferInsert> = { updatedAt: input.updatedAt };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.format !== undefined) patch.format = input.format;
    if (input.maxTeams !== undefined) patch.maxTeams = input.maxTeams;
    if (input.registrationFeeAfn !== undefined) patch.registrationFeeAfn = input.registrationFeeAfn;
    if (input.winPoints !== undefined) patch.winPoints = input.winPoints;
    if (input.drawPoints !== undefined) patch.drawPoints = input.drawPoints;
    if (input.lossPoints !== undefined) patch.lossPoints = input.lossPoints;
    if (input.tieBreakOrder !== undefined) patch.tieBreakOrder = input.tieBreakOrder;
    if (input.rewards !== undefined) patch.rewards = input.rewards;
    if (input.logoUrl !== undefined) patch.logoUrl = input.logoUrl;
    if (input.coverImageUrl !== undefined) patch.coverImageUrl = input.coverImageUrl;
    if (input.groupCount !== undefined) patch.groupCount = input.groupCount;
    if (input.qualifiersPerGroup !== undefined) patch.qualifiersPerGroup = input.qualifiersPerGroup;
    if (input.registrationClosesAt !== undefined) patch.registrationClosesAt = input.registrationClosesAt;
    if (input.matchDurationMinutes !== undefined) patch.matchDurationMinutes = input.matchDurationMinutes;
    if (input.startsAt !== undefined) patch.startsAt = input.startsAt;
    if (input.endsAt !== undefined) patch.endsAt = input.endsAt;
    if(input.maxTeams!==undefined){
      // Serialize limit reductions against approvals and invitation acceptances.
      // They lock this same competition row before checking capacity.
      await this.db.transaction(async tx=>{
        const [row]=await tx.select({id:competitions.id}).from(competitions)
          .where(eq(competitions.id,competitionId)).for("update").limit(1);
        if(!row)return;
        const [accepted]=await tx.select({value:count()}).from(competitionTeams)
          .where(and(eq(competitionTeams.competitionId,competitionId),
            eq(competitionTeams.status,"ACCEPTED")));
        if(Number(accepted?.value??0)>input.maxTeams!)
          throw errors.conflict("TEAM_LIMIT_BELOW_ACCEPTED",
            "Team limit cannot be lower than accepted registrations.");
        await tx.update(competitions).set(patch).where(eq(competitions.id,competitionId));
      });
    }else{
      await this.db.update(competitions).set(patch).where(eq(competitions.id,competitionId));
    }
    return this.getCompetitionDto(competitionId);
  }

  async setCompetitionState(competitionId: string, input: Parameters<CompetitionRepository["setCompetitionState"]>[1]) {
    const patch: Partial<typeof competitions.$inferInsert> = { updatedAt: input.updatedAt };
    if (input.status !== undefined) patch.status = input.status;
    if (input.published !== undefined) patch.published = input.published;
    if (input.publishedAt !== undefined) patch.publishedAt = input.publishedAt;
    if (input.materialPlayStartedAt !== undefined) patch.materialPlayStartedAt = input.materialPlayStartedAt;
    if (input.completedAt !== undefined) patch.completedAt = input.completedAt;
    if (input.archivedAt !== undefined) patch.archivedAt = input.archivedAt;
    await this.db.update(competitions).set(patch).where(eq(competitions.id, competitionId));
    return this.getCompetitionDto(competitionId);
  }

  async getTeam(teamId: string) {
    const [row] = await this.db.select({
      id: teams.id,
      name: teams.name,
      managerUserId: teams.managerUserId,
      offlineVenueId: teams.offlineVenueId,
      claimedAt: teams.claimedAt,
      status: teams.status,
    }).from(teams).where(eq(teams.id, teamId)).limit(1);
    return row ?? null;
  }

  async getRegistration(competitionId: string, teamId: string) {
    const rows = await this.listCompetitionTeams(competitionId);
    return rows.find((item) => item.teamId === teamId) ?? null;
  }

  async applyTeam(input: Parameters<CompetitionRepository["applyTeam"]>[0]) {
    const existing = await this.getRegistration(input.competitionId, input.teamId);
    if (existing) {
      await this.db.update(competitionTeams).set({
        status: "APPLIED",
        appliedByUserId: input.managerUserId,
        respondedByUserId: null,
        respondedAt: null,
        updatedAt: input.now,
      }).where(and(
        eq(competitionTeams.competitionId, input.competitionId),
        eq(competitionTeams.teamId, input.teamId),
      ));
      return;
    }
    await this.db.insert(competitionTeams).values({
      competitionId: input.competitionId,
      teamId: input.teamId,
      status: "APPLIED",
      appliedByUserId: input.managerUserId,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  async inviteTeam(input: Parameters<CompetitionRepository["inviteTeam"]>[0]) {
    const existing = await this.getRegistration(input.competitionId, input.teamId);
    if (existing) {
      await this.db.update(competitionTeams).set({
        status: "INVITED",
        seed: input.seed,
        respondedByUserId: null,
        respondedAt: null,
        updatedAt: input.now,
      }).where(and(
        eq(competitionTeams.competitionId, input.competitionId),
        eq(competitionTeams.teamId, input.teamId),
      ));
      return;
    }
    await this.db.insert(competitionTeams).values({
      competitionId: input.competitionId,
      teamId: input.teamId,
      status: "INVITED",
      seed: input.seed,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  async decideRegistration(input: Parameters<CompetitionRepository["decideRegistration"]>[0]) {
    await this.db.update(competitionTeams).set({
      status: input.status,
      seed: input.seed,
      respondedByUserId: input.ownerUserId,
      respondedAt: input.now,
      updatedAt: input.now,
    }).where(and(
      eq(competitionTeams.competitionId, input.competitionId),
      eq(competitionTeams.teamId, input.teamId),
    ));
  }

  async respondToInvitation(input: Parameters<CompetitionRepository["respondToInvitation"]>[0]) {
    await this.db.update(competitionTeams).set({
      status: input.status,
      respondedByUserId: input.managerUserId,
      respondedAt: input.now,
      updatedAt: input.now,
    }).where(and(
      eq(competitionTeams.competitionId, input.competitionId),
      eq(competitionTeams.teamId, input.teamId),
      eq(competitionTeams.status, "INVITED"),
    ));
  }

  async withdrawTeam(input: Parameters<CompetitionRepository["withdrawTeam"]>[0]) {
    await this.db.update(competitionTeams).set({
      status: "WITHDRAWN",
      respondedByUserId: input.managerUserId,
      respondedAt: input.now,
      updatedAt: input.now,
    }).where(and(
      eq(competitionTeams.competitionId, input.competitionId),
      eq(competitionTeams.teamId, input.teamId),
    ));
  }

  async removeTeamByOwner(input: Parameters<CompetitionRepository["removeTeamByOwner"]>[0]) {
    await this.db.update(competitionTeams).set({
      status: "WITHDRAWN",
      groupId: null,
      respondedByUserId: input.ownerUserId,
      respondedAt: input.now,
      updatedAt: input.now,
    }).where(and(
      eq(competitionTeams.competitionId, input.competitionId),
      eq(competitionTeams.teamId, input.teamId),
    ));
  }

  async countAcceptedTeams(competitionId: string) {
    const [row] = await this.db.select({ value: count() }).from(competitionTeams).where(and(
      eq(competitionTeams.competitionId, competitionId),
      eq(competitionTeams.status, "ACCEPTED"),
    ));
    return Number(row?.value ?? 0);
  }

  async hasCompletedMatch(competitionId: string) {
    const [row] = await this.db.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
      eq(competitionMatches.competitionId, competitionId),
      inArray(competitionMatches.status, ["COMPLETED", "CORRECTED"]),
    )).limit(1);
    return Boolean(row);
  }

  async deleteCompetition(competitionId: string) {
    const removed = await this.db.transaction(async (tx) => {
      await tx.delete(socialPosts).where(and(
        eq(socialPosts.entityType, "COMPETITION"),
        eq(socialPosts.entityId, competitionId),
      ));
      return tx.delete(competitions)
        .where(eq(competitions.id, competitionId))
        .returning({ id: competitions.id });
    });
    return removed.length > 0;
  }

  async updateTeamFee(input: Parameters<CompetitionRepository["updateTeamFee"]>[0]) {
    const confirmed = input.status === "PAID" || input.status === "WAIVED";
    await this.db.update(competitionTeams).set({
      feeStatus: input.status,
      feePaymentReference: input.paymentReference,
      feeConfirmedAt: confirmed ? input.now : null,
      feeConfirmedByUserId: confirmed ? input.ownerUserId : null,
      updatedAt: input.now,
    }).where(and(
      eq(competitionTeams.competitionId, input.competitionId),
      eq(competitionTeams.teamId, input.teamId),
    ));
    return this.getRegistration(input.competitionId, input.teamId);
  }

  async listCompetitionMedia(competitionId: string, includeUnpublished: boolean): Promise<CompetitionMediaPostDto[]> {
    const rows = await this.db.select().from(socialPosts)
      .where(and(
        eq(socialPosts.entityType, "COMPETITION"),
        eq(socialPosts.entityId, competitionId),
        // Public media must be public both in status and audience visibility.
        includeUnpublished?undefined:eq(socialPosts.status,"PUBLISHED"),
        includeUnpublished?undefined:eq(socialPosts.visibility,"PUBLIC"),
      ))
      .orderBy(desc(socialPosts.publishedAt));
    return rows
      .map((row) => ({
        id: row.id,
        competitionId,
        body: row.body,
        imageUrl: row.imageUrl,
        status: row.status,
        publishedAt: row.publishedAt.toISOString(),
        unpublishedAt: row.unpublishedAt?.toISOString() ?? null,
      }));
  }

  async createCompetitionMediaPost(input: Parameters<CompetitionRepository["createCompetitionMediaPost"]>[0]) {
    const [created] = await this.db.insert(socialPosts).values({
      entityType: "COMPETITION",
      entityId: input.competitionId,
      createdByUserId: input.ownerUserId,
      body: input.body,
      imageUrl: input.imageUrl,
      status: "PUBLISHED",
      publishedAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
    }).returning();
    if (!created) throw new Error("Competition media post could not be created.");
    return {
      id: created.id,
      competitionId: input.competitionId,
      body: created.body,
      imageUrl: created.imageUrl,
      status: created.status,
      publishedAt: created.publishedAt.toISOString(),
      unpublishedAt: created.unpublishedAt?.toISOString() ?? null,
    };
  }

  async setCompetitionMediaStatus(input: Parameters<CompetitionRepository["setCompetitionMediaStatus"]>[0]) {
    const [updated] = await this.db.update(socialPosts).set({
      status: input.published ? "PUBLISHED" : "UNPUBLISHED",
      ...(input.published ? { publishedAt: input.now, unpublishedAt: null } : { unpublishedAt: input.now }),
      updatedAt: input.now,
    }).where(and(
      eq(socialPosts.id, input.postId),
      eq(socialPosts.entityType, "COMPETITION"),
      eq(socialPosts.entityId, input.competitionId),
    )).returning();
    if (!updated) return null;
    return {
      id: updated.id,
      competitionId: input.competitionId,
      body: updated.body,
      imageUrl: updated.imageUrl,
      status: updated.status,
      publishedAt: updated.publishedAt.toISOString(),
      unpublishedAt: updated.unpublishedAt?.toISOString() ?? null,
    };
  }

  async listCompetitionFollowerUserIds(competitionId: string) {
    const rows = await this.db.select({ userId: socialFollows.userId }).from(socialFollows)
      .where(and(
        eq(socialFollows.entityType, "COMPETITION"),
        eq(socialFollows.entityId, competitionId),
      ));
    return rows.map((row) => row.userId);
  }


  async replaceGroupStage(
    competitionId: string,
    groups: Array<{
      name: string;
      sortOrder: number;
      teamIds: string[];
      fixtures: Array<{ roundNumber: number; slotNumber: number; homeTeamId: string; awayTeamId: string }>;
    }>,
    now: Date,
  ) {
    await this.db.transaction(async (tx) => {
      const [played] = await tx.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
        eq(competitionMatches.competitionId, competitionId),
        inArray(competitionMatches.status, ["IN_PROGRESS", "COMPLETED", "CORRECTED"]),
      )).limit(1);
      if (played) throw errors.conflict("FIXTURES_LOCKED", "Group fixtures cannot be regenerated after play begins.");

      await tx.delete(competitionMatches).where(eq(competitionMatches.competitionId, competitionId));
      await tx.update(competitionTeams).set({ groupId: null, qualifiedAt: null, updatedAt: now })
        .where(eq(competitionTeams.competitionId, competitionId));
      await tx.delete(competitionGroups).where(eq(competitionGroups.competitionId, competitionId));

      for (const group of groups) {
        const [created] = await tx.insert(competitionGroups).values({
          competitionId,
          name: group.name,
          sortOrder: group.sortOrder,
          createdAt: now,
        }).returning({ id: competitionGroups.id });
        if (!created) throw new Error("Competition group could not be created.");

        for (const teamId of group.teamIds) {
          await tx.update(competitionTeams).set({ groupId: created.id, updatedAt: now }).where(and(
            eq(competitionTeams.competitionId, competitionId),
            eq(competitionTeams.teamId, teamId),
            eq(competitionTeams.status, "ACCEPTED"),
          ));
        }

        if (group.fixtures.length > 0) {
          await tx.insert(competitionMatches).values(group.fixtures.map((fixture) => ({
            competitionId,
            groupId: created.id,
            stage: "GROUP" as const,
            roundNumber: fixture.roundNumber,
            slotNumber: fixture.slotNumber,
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            status: "UNSCHEDULED" as const,
            createdAt: now,
            updatedAt: now,
          })));
        }
      }
    });
  }

  async replaceKnockoutStage(
    competitionId: string,
    matches: Array<{
      key: string;
      roundNumber: number;
      slotNumber: number;
      homeTeamId: string | null;
      awayTeamId: string | null;
      nextKey: string | null;
      nextSide: "HOME" | "AWAY" | null;
    }>,
    qualifiedTeamIds: string[],
    now: Date,
  ) {
    await this.db.transaction(async (tx) => {
      const [started] = await tx.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
        eq(competitionMatches.competitionId, competitionId),
        eq(competitionMatches.stage, "KNOCKOUT"),
        inArray(competitionMatches.status, ["IN_PROGRESS", "COMPLETED", "CORRECTED"]),
      )).limit(1);
      if (started) throw errors.conflict("KNOCKOUT_LOCKED", "Knockout bracket cannot be rebuilt after knockout play begins.");

      await tx.delete(competitionMatches).where(and(
        eq(competitionMatches.competitionId, competitionId),
        eq(competitionMatches.stage, "KNOCKOUT"),
      ));
      await tx.update(competitionTeams).set({ qualifiedAt: null, updatedAt: now })
        .where(eq(competitionTeams.competitionId, competitionId));
      for (const teamId of qualifiedTeamIds) {
        await tx.update(competitionTeams).set({ qualifiedAt: now, updatedAt: now }).where(and(
          eq(competitionTeams.competitionId, competitionId),
          eq(competitionTeams.teamId, teamId),
        ));
      }

      const ids = new Map<string,string>();
      for (const match of matches) {
        const [created] = await tx.insert(competitionMatches).values({
          competitionId,
          stage: "KNOCKOUT",
          roundNumber: match.roundNumber,
          slotNumber: match.slotNumber,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          status: "UNSCHEDULED",
          nextMatchSide: match.nextSide,
          createdAt: now,
          updatedAt: now,
        }).returning({ id: competitionMatches.id });
        if (!created) throw new Error("Knockout match could not be created.");
        ids.set(match.key, created.id);
      }

      for (const match of matches) {
        const id = ids.get(match.key)!;
        await tx.update(competitionMatches).set({
          nextMatchId: match.nextKey ? ids.get(match.nextKey) ?? null : null,
          updatedAt: now,
        }).where(eq(competitionMatches.id, id));
      }
    });
  }

  async groupStageCompleted(competitionId: string) {
    const rows = await this.db.select({ status: competitionMatches.status }).from(competitionMatches).where(and(
      eq(competitionMatches.competitionId, competitionId),
      eq(competitionMatches.stage, "GROUP"),
    ));
    return rows.length > 0 && rows.every((row) => row.status === "COMPLETED" || row.status === "CORRECTED");
  }

  async knockoutStarted(competitionId: string) {
    const [row] = await this.db.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
      eq(competitionMatches.competitionId, competitionId),
      eq(competitionMatches.stage, "KNOCKOUT"),
      inArray(competitionMatches.status, ["IN_PROGRESS", "COMPLETED", "CORRECTED"]),
    )).limit(1);
    return Boolean(row);
  }

  async knockoutCompleted(competitionId: string) {
    const rows = await this.db.select({ status: competitionMatches.status }).from(competitionMatches).where(and(
      eq(competitionMatches.competitionId, competitionId),
      eq(competitionMatches.stage, "KNOCKOUT"),
    ));
    return rows.length > 0 && rows.every((row) => row.status === "COMPLETED" || row.status === "CORRECTED");
  }

  async advanceKnockoutWinner(matchId: string, winnerTeamId: string, now: Date) {
    await this.db.transaction(async (tx) => {
      const [match] = await tx.select().from(competitionMatches).where(eq(competitionMatches.id, matchId)).limit(1);
      if (!match || !match.nextMatchId || !match.nextMatchSide) return;
      const patch = match.nextMatchSide === "HOME"
        ? { homeTeamId: winnerTeamId, updatedAt: now }
        : { awayTeamId: winnerTeamId, updatedAt: now };
      await tx.update(competitionMatches).set(patch).where(eq(competitionMatches.id, match.nextMatchId));
    });
  }

  async replaceKnockoutParticipant(matchId: string, winnerTeamId: string, now: Date) {
    return this.advanceKnockoutWinner(matchId, winnerTeamId, now);
  }

  async replaceLeagueFixtures(
    competitionId: string,
    fixtures: Array<{ roundNumber: number; slotNumber: number; homeTeamId: string; awayTeamId: string }>,
    now: Date,
  ) {
    await this.db.transaction(async (tx) => {
      const [played] = await tx.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
        eq(competitionMatches.competitionId, competitionId),
        inArray(competitionMatches.status, ["COMPLETED", "CORRECTED", "IN_PROGRESS"]),
      )).limit(1);
      if (played) throw errors.conflict("FIXTURES_LOCKED", "Fixtures cannot be regenerated after play begins.");

      await tx.delete(competitionMatches).where(eq(competitionMatches.competitionId, competitionId));
      if (fixtures.length > 0) {
        await tx.insert(competitionMatches).values(fixtures.map((fixture) => ({
          competitionId,
          stage: "LEAGUE" as const,
          roundNumber: fixture.roundNumber,
          slotNumber: fixture.slotNumber,
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          status: "UNSCHEDULED" as const,
          createdAt: now,
          updatedAt: now,
        })));
      }
    });
  }

  async listPublicMatchPlayerStats(matchId:string):Promise<CompetitionPublicMatchPlayer[]>{
    const rows=await this.db.select({
      playerUserId:playerMatchStats.playerUserId,
      teamId:playerMatchStats.teamId,teamName:teams.name,
      publicDisplayName:playerProfiles.publicDisplayName,
      fallbackName:users.displayName,appeared:playerMatchStats.appeared,
      goals:playerMatchStats.goals,assists:playerMatchStats.assists,
      yellowCards:playerMatchStats.yellowCards,redCards:playerMatchStats.redCards,
      cleanSheet:playerMatchStats.cleanSheet,playerOfMatch:playerMatchStats.playerOfMatch,
    }).from(playerMatchStats)
      .innerJoin(users,eq(playerMatchStats.playerUserId,users.id))
      .innerJoin(teams,eq(playerMatchStats.teamId,teams.id))
      .leftJoin(playerProfiles,eq(playerMatchStats.playerUserId,playerProfiles.userId))
      .where(eq(playerMatchStats.matchId,matchId));
    return rows.map(row=>({
      playerUserId:row.playerUserId,teamId:row.teamId,teamName:row.teamName,
      publicDisplayName:row.publicDisplayName??row.fallbackName,
      appeared:row.appeared,goals:row.goals,assists:row.assists,
      yellowCards:row.yellowCards,redCards:row.redCards,
      cleanSheet:row.cleanSheet,playerOfMatch:row.playerOfMatch,
    }));
  }

  async getMatch(matchId: string) {
    const [row] = await this.db.select({ competitionId: competitionMatches.competitionId })
      .from(competitionMatches)
      .where(eq(competitionMatches.id, matchId))
      .limit(1);
    if (!row) return null;
    const matches = await this.listMatchDtos(row.competitionId);
    return matches.find((match) => match.id === matchId) ?? null;
  }

  async saveMatchResult(input: Parameters<CompetitionRepository["saveMatchResult"]>[0]) {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.competitionId}))`);

      const [match] = await tx.select().from(competitionMatches).where(and(
        eq(competitionMatches.id, input.matchId),
        eq(competitionMatches.competitionId, input.competitionId),
      )).limit(1);
      if (!match || !match.homeTeamId || !match.awayTeamId) {
        throw errors.badRequest("MATCH_NOT_READY", "This match does not have two teams.");
      }

      for (const stat of input.playerStats) {
        if (stat.teamId !== match.homeTeamId && stat.teamId !== match.awayTeamId) {
          throw errors.badRequest("STAT_TEAM_MISMATCH", "Player statistics must belong to a team in this match.");
        }
        const [membership] = await tx.select({ userId: teamMemberships.userId }).from(teamMemberships).where(and(
          eq(teamMemberships.teamId, stat.teamId),
          eq(teamMemberships.userId, stat.playerUserId),
          eq(teamMemberships.status, "ACTIVE"),
        )).limit(1);
        if (!membership) {
          throw errors.badRequest("STAT_PLAYER_NOT_ON_TEAM", "A player statistic references someone outside the active roster.");
        }
      }

      const before = {
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        winnerTeamId: match.winnerTeamId,
      };
      const correction = match.status === "COMPLETED" || match.status === "CORRECTED";

      await tx.delete(playerMatchStats).where(eq(playerMatchStats.matchId, input.matchId));
      if (input.playerStats.length > 0) {
        await tx.insert(playerMatchStats).values(input.playerStats.map((stat) => ({
          matchId: input.matchId,
          playerUserId: stat.playerUserId,
          teamId: stat.teamId,
          appeared: stat.appeared,
          goals: stat.goals,
          assists: stat.assists,
          yellowCards: stat.yellowCards,
          redCards: stat.redCards,
          cleanSheet: stat.cleanSheet,
          playerOfMatch: stat.playerOfMatch,
          updatedAt: input.now,
        })));
      }

      await tx.update(competitionMatches).set({
        status: correction ? "CORRECTED" : "COMPLETED",
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        winnerTeamId: input.winnerTeamId,
        resultEnteredByUserId: input.actorUserId,
        resultEnteredAt: input.now,
        correctionReason: input.correctionReason,
        updatedAt: input.now,
      }).where(eq(competitionMatches.id, input.matchId));

      if (correction) {
        await tx.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          action: "COMPETITION_RESULT_CORRECTED",
          targetType: "competition_match",
          targetId: input.matchId,
          metadata: {
            competitionId: input.competitionId,
            before,
            after: {
              homeScore: input.homeScore,
              awayScore: input.awayScore,
              winnerTeamId: input.winnerTeamId,
            },
            reason: input.correctionReason,
          },
          createdAt: input.now,
        });
      }
    });

    const match = await this.getMatch(input.matchId);
    if (!match) throw new Error("Match could not be loaded after result save.");
    return match;
  }

  async allRequiredMatchesCompleted(competitionId: string) {
    const rows = await this.db.select({ status: competitionMatches.status }).from(competitionMatches)
      .where(eq(competitionMatches.competitionId, competitionId));
    return rows.length > 0 && rows.every((row) => row.status === "COMPLETED" || row.status === "CORRECTED");
  }

  async scheduleMatchAtomic(input: Parameters<CompetitionRepository["scheduleMatchAtomic"]>[0]) {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.areaId}))`);
      // Coordinate fixture reassignment with the referee's report mutations.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.matchId}))`);

      const [area] = await tx.select({ id: venueAreas.id }).from(venueAreas).where(and(
        eq(venueAreas.id, input.areaId),
        eq(venueAreas.venueId, input.venueId),
        eq(venueAreas.active, true),
      )).limit(1);
      if (!area) throw errors.badRequest("AREA_NOT_AVAILABLE", "This playing area is unavailable.");

      const [booking] = await tx.select({ id: bookings.id }).from(bookings).where(and(
        eq(bookings.areaId, input.areaId),
        inArray(bookings.status, ["PENDING", "CONFIRMED"]),
        lt(bookings.startsAt, input.endsAt),
        gt(bookings.endsAt, input.startsAt),
      )).limit(1);
      if (booking) throw errors.conflict("SLOT_UNAVAILABLE", "That time is occupied by a booking.");

      const [block] = await tx.select({ id: venueBlocks.id }).from(venueBlocks).where(and(
        eq(venueBlocks.areaId, input.areaId),
        lt(venueBlocks.startsAt, input.endsAt),
        gt(venueBlocks.endsAt, input.startsAt),
      )).limit(1);
      if (block) throw errors.conflict("SLOT_UNAVAILABLE", "That time is blocked.");

      const [match] = await tx.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
        eq(competitionMatches.areaId, input.areaId),
        ne(competitionMatches.id, input.matchId),
        inArray(competitionMatches.status, ["SCHEDULED", "IN_PROGRESS"]),
        lt(competitionMatches.startsAt, input.endsAt),
        gt(competitionMatches.endsAt, input.startsAt),
      )).limit(1);
      if (match) throw errors.conflict("SLOT_UNAVAILABLE", "That time is occupied by another competition match.");

      const [ownedMatch] = await tx.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
        eq(competitionMatches.id, input.matchId),
        eq(competitionMatches.competitionId, input.competitionId),
      )).limit(1);
      if (!ownedMatch) throw errors.badRequest("MATCH_NOT_FOUND", "Competition match not found.");

      const [inProgressReport]=await tx.select({status:refereeMatchReports.status,
        startedAt:refereeMatchReports.startedAt}).from(refereeMatchReports)
        .where(eq(refereeMatchReports.matchId,input.matchId)).limit(1);
      if(inProgressReport&&(inProgressReport.startedAt||inProgressReport.status!=="DRAFT"))
        throw errors.conflict("REFEREE_MATCH_LOCKED","A referee has started or submitted a match report. Scheduling is locked.");
      // A pre-kickoff draft belongs to its original assignment. Clear it during
      // an organizer's reschedule/reassignment, otherwise a new referee cannot
      // initialize their own report for this same fixture.
      if(inProgressReport)await tx.delete(refereeMatchReports)
        .where(eq(refereeMatchReports.matchId,input.matchId));

      await tx.update(competitionMatches).set({
        venueId: input.venueId,
        areaId: input.areaId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        refereeUserId: input.refereeUserId,
        status: "SCHEDULED",
        updatedAt: input.updatedAt,
      }).where(eq(competitionMatches.id, input.matchId));
      // Every scheduling/reassignment resets the invitation atomically, including
      // a referee's previously accepted/declined assignment to the same fixture.
      if(input.refereeUserId){
        await tx.insert(refereeMatchResponses).values({
          matchId:input.matchId,refereeUserId:input.refereeUserId,status:"PENDING",
          reason:null,respondedAt:null,updatedAt:input.updatedAt,
        }).onConflictDoUpdate({
          target:[refereeMatchResponses.matchId,refereeMatchResponses.refereeUserId],
          set:{status:"PENDING",reason:null,respondedAt:null,updatedAt:input.updatedAt},
        });
      }
    });
  }
}
