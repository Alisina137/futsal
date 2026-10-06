import type {
  CompetitionDto,
  CompetitionFeeStatus,
  CompetitionFormat,
  CompetitionListItemDto,
  CompetitionMediaPostDto,
  CompetitionMatchDto,
  CompetitionRegistrationStatus,
  PlayerMatchStatInput,
  CompetitionTieBreak,
  TeamPrivacy,
} from "@leaguekick/contracts";

export type CompetitionVenueRecord = {
  id: string;
  ownerUserId: string;
  name: string;
  status: "DRAFT" | "READY" | "ACTIVE" | "SUSPENDED";
  areas: Array<{ id: string; name: string; active: boolean }>;
  subscription: {
    status: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";
    trialEndsAt: Date | null;
    activeUntil: Date | null;
  } | null;
};

export type CompetitionRecord = {
  id: string;
  venueId: string;
  createdByUserId: string;
  name: string;
  description: string | null;
  format: CompetitionFormat;
  status: "DRAFT" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED" | "CANCELLED";
  published: boolean;
  maxTeams: number;
  registrationFeeAfn: number;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  tieBreakOrder: CompetitionTieBreak[];
  groupCount: number | null;
  qualifiersPerGroup: number | null;
  registrationClosesAt: Date | null;
  matchDurationMinutes: number;
  startsAt: Date | null;
  endsAt: Date | null;
  materialPlayStartedAt: Date | null;
};

export type CompetitionTeamRecord = {
  competitionId: string;
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  managerUserId: string;
  teamPrivacy: TeamPrivacy;
  status: CompetitionRegistrationStatus;
  seed: number | null;
  groupId: string | null;
  groupName: string | null;
  feeStatus: CompetitionFeeStatus;
  feePaymentReference: string | null;
  feeConfirmedAt: Date | null;
};

export interface CompetitionRepository {
  getOwnerVenue(ownerUserId: string): Promise<CompetitionVenueRecord | null>;
  isVenueReferee(venueId: string, userId: string): Promise<boolean>;
  getCompetitionRecord(competitionId: string): Promise<CompetitionRecord | null>;
  getCompetitionDto(competitionId: string): Promise<CompetitionDto | null>;
  listOwnerCompetitions(ownerUserId: string): Promise<CompetitionListItemDto[]>;
  listPublicCompetitions(): Promise<CompetitionListItemDto[]>;
  createCompetition(input: {
    venueId: string;
    createdByUserId: string;
    name: string;
    description: string | null;
    format: CompetitionFormat;
    maxTeams: number;
    registrationFeeAfn: number;
    winPoints: number;
    drawPoints: number;
    lossPoints: number;
    tieBreakOrder: CompetitionTieBreak[];
    groupCount: number | null;
    qualifiersPerGroup: number | null;
    registrationClosesAt: Date | null;
    matchDurationMinutes: number;
    startsAt: Date | null;
    endsAt: Date | null;
    now: Date;
  }): Promise<CompetitionDto>;
  updateCompetition(competitionId: string, input: {
    name?: string;
    description?: string | null;
    format?: CompetitionFormat;
    maxTeams?: number;
    registrationFeeAfn?: number;
    winPoints?: number;
    drawPoints?: number;
    lossPoints?: number;
    tieBreakOrder?: CompetitionTieBreak[];
    groupCount?: number | null;
    qualifiersPerGroup?: number | null;
    registrationClosesAt?: Date | null;
    matchDurationMinutes?: number;
    startsAt?: Date | null;
    endsAt?: Date | null;
    updatedAt: Date;
  }): Promise<CompetitionDto | null>;
  setCompetitionState(competitionId: string, input: {
    status?: CompetitionRecord["status"];
    published?: boolean;
    publishedAt?: Date | null;
    materialPlayStartedAt?: Date | null;
    completedAt?: Date | null;
    archivedAt?: Date | null;
    updatedAt: Date;
  }): Promise<CompetitionDto | null>;
  getTeam(teamId: string): Promise<{ id: string; name: string; managerUserId: string; status: "ACTIVE" | "ARCHIVED" } | null>;
  getRegistration(competitionId: string, teamId: string): Promise<CompetitionTeamRecord | null>;
  listCompetitionTeams(competitionId: string): Promise<CompetitionTeamRecord[]>;
  applyTeam(input: { competitionId: string; teamId: string; managerUserId: string; now: Date }): Promise<void>;
  inviteTeam(input: { competitionId: string; teamId: string; ownerUserId: string; seed: number | null; now: Date }): Promise<void>;
  decideRegistration(input: {
    competitionId: string;
    teamId: string;
    ownerUserId: string;
    status: "ACCEPTED" | "REJECTED";
    seed: number | null;
    now: Date;
  }): Promise<void>;
  respondToInvitation(input: {
    competitionId: string;
    teamId: string;
    managerUserId: string;
    status: "ACCEPTED" | "REJECTED";
    now: Date;
  }): Promise<void>;
  withdrawTeam(input: { competitionId: string; teamId: string; managerUserId: string; now: Date }): Promise<void>;
  removeTeamByOwner(input: { competitionId: string; teamId: string; ownerUserId: string; now: Date }): Promise<void>;
  countAcceptedTeams(competitionId: string): Promise<number>;
  hasCompletedMatch(competitionId: string): Promise<boolean>;
  deleteCompetition(competitionId: string): Promise<boolean>;
  updateTeamFee(input: {
    competitionId: string;
    teamId: string;
    ownerUserId: string;
    status: CompetitionFeeStatus;
    paymentReference: string | null;
    now: Date;
  }): Promise<CompetitionTeamRecord | null>;
  listCompetitionMedia(competitionId: string, includeUnpublished: boolean): Promise<CompetitionMediaPostDto[]>;
  createCompetitionMediaPost(input: {
    competitionId: string;
    ownerUserId: string;
    body: string;
    imageUrl: string | null;
    now: Date;
  }): Promise<CompetitionMediaPostDto>;
  setCompetitionMediaStatus(input: {
    competitionId: string;
    postId: string;
    published: boolean;
    now: Date;
  }): Promise<CompetitionMediaPostDto | null>;
  listCompetitionFollowerUserIds(competitionId: string): Promise<string[]>;
  replaceLeagueFixtures(competitionId: string, fixtures: Array<{
    roundNumber: number;
    slotNumber: number;
    homeTeamId: string;
    awayTeamId: string;
  }>, now: Date): Promise<void>;
  replaceGroupStage(competitionId: string, groups: Array<{
    name: string;
    sortOrder: number;
    teamIds: string[];
    fixtures: Array<{
      roundNumber: number;
      slotNumber: number;
      homeTeamId: string;
      awayTeamId: string;
    }>;
  }>, now: Date): Promise<void>;
  replaceKnockoutStage(competitionId: string, matches: Array<{
    key: string;
    roundNumber: number;
    slotNumber: number;
    homeTeamId: string | null;
    awayTeamId: string | null;
    nextKey: string | null;
    nextSide: "HOME" | "AWAY" | null;
  }>, qualifiedTeamIds: string[], now: Date): Promise<void>;
  groupStageCompleted(competitionId: string): Promise<boolean>;
  knockoutStarted(competitionId: string): Promise<boolean>;
  knockoutCompleted(competitionId: string): Promise<boolean>;
  advanceKnockoutWinner(matchId: string, winnerTeamId: string, now: Date): Promise<void>;
  replaceKnockoutParticipant(matchId: string, winnerTeamId: string, now: Date): Promise<void>;
  getMatch(matchId: string): Promise<CompetitionMatchDto | null>;
  saveMatchResult(input: {
    competitionId: string;
    matchId: string;
    actorUserId: string;
    homeScore: number;
    awayScore: number;
    winnerTeamId: string | null;
    correctionReason: string | null;
    playerStats: PlayerMatchStatInput[];
    now: Date;
  }): Promise<CompetitionMatchDto>;
  allRequiredMatchesCompleted(competitionId: string): Promise<boolean>;
  scheduleMatchAtomic(input: {
    competitionId: string;
    matchId: string;
    venueId: string;
    areaId: string;
    startsAt: Date;
    endsAt: Date;
    refereeUserId: string | null;
    updatedAt: Date;
  }): Promise<void>;
}
