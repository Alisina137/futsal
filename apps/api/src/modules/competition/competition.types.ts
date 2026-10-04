import type {
  CompetitionDto,
  CompetitionFormat,
  CompetitionListItemDto,
  CompetitionRegistrationStatus,
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
};

export interface CompetitionRepository {
  getOwnerVenue(ownerUserId: string): Promise<CompetitionVenueRecord | null>;
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
    startsAt?: Date | null;
    endsAt?: Date | null;
    updatedAt: Date;
  }): Promise<CompetitionDto | null>;
  setCompetitionState(competitionId: string, input: {
    status?: CompetitionRecord["status"];
    published?: boolean;
    publishedAt?: Date | null;
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
  countAcceptedTeams(competitionId: string): Promise<number>;
  hasCompletedMatch(competitionId: string): Promise<boolean>;
  scheduleMatchAtomic(input: {
    competitionId: string;
    matchId: string;
    venueId: string;
    areaId: string;
    startsAt: Date;
    endsAt: Date;
    updatedAt: Date;
  }): Promise<void>;
}
