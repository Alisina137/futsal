import { randomUUID } from "node:crypto";
import type {
  OwnPlayerProfileDto,
  PublicPlayerProfileDto,
  TeamDirectoryItemDto,
  TeamDiscoveryQuery,
  TeamDiscoveryResponse,
  TeamDto,
  TeamInvitationDto,
  TeamJoinRequestDto,
  TeamListItemDto,
  TeamMemberRole,
} from "@leaguekick/contracts";
import { errors } from "../src/lib/errors.js";
import type { UserRole } from "@leaguekick/contracts";
import type {
  TeamIdentityUser,
  TeamMembershipRecord,
  TeamRecord,
  TeamRepository,
} from "../src/modules/team/team.types.js";

export class FakeTeamRepository implements TeamRepository {
  /** Test fake assumes seeded manager entitlements are paid; live Drizzle repository validates slots. */
  async assertManagerSubscription(_userId:string,_teamId:string,_now:Date):Promise<void>{}

  users = new Map<string, TeamIdentityUser & { usernameNormalized: string | null; phoneE164: string; emailNormalized: string | null }>();
  profiles = new Map<string, OwnPlayerProfileDto>();
  teams = new Map<string, TeamRecord>();
  memberships = new Map<string, TeamMembershipRecord>();
  invitations = new Map<string, TeamInvitationDto>();
  joinRequests = new Map<string, TeamJoinRequestDto>();
  joinRequestsAllowed = new Map<string,boolean>();
  teamLocations=new Map<string,{province:string|null;district:string|null}>();
  teamFollowerCounts=new Map<string,number>();
  teamFollowings=new Set<string>();

  seedUser(input: {
    id: string;
    displayName: string;
    username?: string | null;
    phoneE164: string;
    email?: string | null;
    roles?: UserRole[];
  }) {
    this.users.set(input.id, {
      id: input.id,
      displayName: input.displayName,
      username: input.username ?? null,
      usernameNormalized: input.username?.toLowerCase() ?? null,
      phoneE164: input.phoneE164,
      emailNormalized:input.email?.trim().toLowerCase()??null,
      roles: input.roles ?? ["PLAYER"],
    });
  }

  private membershipKey(teamId: string, userId: string) {
    return `${teamId}:${userId}`;
  }

  async getUserIdentity(userId: string) {
    const user = this.users.get(userId);
    return user ? { id: user.id, displayName: user.displayName, username: user.username, roles: user.roles } : null;
  }

  async getUserByNormalizedIdentifier(input: { usernameNormalized?: string; phoneE164?: string; emailNormalized?: string }) {
    const user = [...this.users.values()].find((item) =>
      (input.usernameNormalized && item.usernameNormalized === input.usernameNormalized) ||
      (input.phoneE164 && item.phoneE164 === input.phoneE164) ||
      (input.emailNormalized && item.emailNormalized === input.emailNormalized)
    );
    return user ? { id: user.id, displayName: user.displayName, username: user.username, roles: user.roles } : null;
  }

  private playerTeams(userId: string, publicOnly: boolean) {
    const result: OwnPlayerProfileDto["teams"] = [];
    for (const membership of this.memberships.values()) {
      if (membership.userId !== userId || membership.status !== "ACTIVE") continue;
      const team = this.teams.get(membership.teamId);
      if (!team || team.status !== "ACTIVE" || (publicOnly && team.privacy !== "PUBLIC")) continue;
      result.push({
        id: team.id,
        name: team.name,
        logoUrl: team.logoUrl,
        city: team.city,
        role: membership.role,
      });
    }
    return result;
  }

  async ensurePlayerProfile(userId: string, fallbackDisplayName: string, _now: Date) {
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = {
        userId,
        publicDisplayName: fallbackDisplayName,
        imageUrl: null,
        position: "UNSPECIFIED",
        visibility: "PUBLIC",
        teams: [],
      };
      this.profiles.set(userId, profile);
    }
    const next = { ...profile, teams: this.playerTeams(userId, false) };
    this.profiles.set(userId, next);
    return next;
  }

  async updatePlayerProfile(userId: string, input: {
    publicDisplayName?: string;
    imageUrl?: string | null;
    position?: OwnPlayerProfileDto["position"];
    visibility?: OwnPlayerProfileDto["visibility"];
    updatedAt: Date;
  }) {
    const current = this.profiles.get(userId);
    if (!current) throw new Error("profile missing");
    const next: OwnPlayerProfileDto = {
      ...current,
      ...(input.publicDisplayName !== undefined ? { publicDisplayName: input.publicDisplayName } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      teams: this.playerTeams(userId, false),
    };
    this.profiles.set(userId, next);
    return next;
  }

  async getOwnPlayerProfile(userId: string) {
    const user = this.users.get(userId);
    if (!user) return null;
    const profile = this.profiles.get(userId);
    return {
      userId,
      publicDisplayName: profile?.publicDisplayName ?? user.displayName,
      imageUrl: profile?.imageUrl ?? null,
      position: profile?.position ?? "UNSPECIFIED",
      visibility: profile?.visibility ?? "PUBLIC",
      teams: this.playerTeams(userId, false),
    };
  }

  async getPublicPlayerProfile(userId: string): Promise<PublicPlayerProfileDto | null> {
    const profile = this.profiles.get(userId);
    if (!profile || profile.visibility !== "PUBLIC") return null;
    return {
      userId,
      publicDisplayName: profile.publicDisplayName,
      imageUrl: profile.imageUrl,
      position: profile.position,
      teams: this.playerTeams(userId, true),
    };
  }

  private members(teamId: string): TeamDto["members"] {
    return [...this.memberships.values()]
      .filter((membership) => membership.teamId === teamId && membership.status === "ACTIVE")
      .map((membership) => {
        const user = this.users.get(membership.userId)!;
        const profile = this.profiles.get(membership.userId);
        return {
          userId: membership.userId,
          publicDisplayName: profile?.publicDisplayName ?? user.displayName,
          imageUrl: profile?.imageUrl ?? null,
          position: profile?.position ?? "UNSPECIFIED",
          role: membership.role,
          shirtNumber: membership.shirtNumber,
          joinedAt: membership.joinedAt.toISOString(),
        };
      });
  }

  async createTeam(input: {
    name: string;
    logoUrl: string | null;
    city: string;
    managerUserId: string;
    privacy: "PUBLIC" | "PRIVATE";
    now: Date;
  }) {
    const id = randomUUID();
    this.teams.set(id, {
      id,
      name: input.name,
      logoUrl: input.logoUrl,
      city: input.city,
      managerUserId: input.managerUserId,
      offlineVenueId: null,
      claimedAt: null,
      captainUserId: null,
      status: "ACTIVE",
      privacy: input.privacy,
      createdAt: input.now,
    });
    this.memberships.set(this.membershipKey(id, input.managerUserId), {
      teamId: id,
      userId: input.managerUserId,
      role: "MANAGER",
      shirtNumber: null,
      status: "ACTIVE",
      joinedAt: input.now,
      leftAt: null,
    });
    return (await this.getTeam(id, true))!;
  }

  async getTeamRecord(teamId: string) {
    return this.teams.get(teamId) ?? null;
  }

  async getTeam(teamId: string, includeRoster: boolean, publicRoster=false) {
    const team = this.teams.get(teamId);
    if (!team) return null;
    const allMembers=this.members(teamId);
    const members = allMembers.filter(member=>!publicRoster||
      this.profiles.get(member.userId)?.visibility==="PUBLIC");
    return {
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
      city: team.city,
      status: team.status,
      privacy: team.privacy,
      managerUserId: team.managerUserId,
      captainUserId: team.captainUserId,
      rosterCount: allMembers.length,
      members: includeRoster ? members : [],
      createdAt: team.createdAt.toISOString(),
    };
  }

  async listDirectoryTeams(userId:string):Promise<TeamDirectoryItemDto[]>{
    const result:TeamDirectoryItemDto[]=[];
    for(const team of this.teams.values()){
      if(team.status!=="ACTIVE")continue;
      const dto=await this.getTeam(team.id,false);
      if(!dto)continue;
      const {members:_members,...summary}=dto;
      const membership=this.memberships.get(this.membershipKey(team.id,userId));
      const pending=[...this.joinRequests.values()].find((request)=>
        request.teamId===team.id&&request.requesterUserId===userId&&request.status==="PENDING"
      );
      result.push({
        ...summary,
        myMembershipRole:membership?.status==="ACTIVE"?membership.role:null,
        joinRequestStatus:pending?.status??null,
        allowJoinRequests:await this.allowsJoinRequests(team.id),
      });
    }
    return result.sort((a,b)=>a.name.localeCompare(b.name));
  }

  async discoverTeams(userId:string,filters:TeamDiscoveryQuery):Promise<TeamDiscoveryResponse>{
    const available=await this.listDirectoryTeams(userId);
    // Fake mirrors production constraints and never leaks other users' join state.
    const eligible=available.filter(team=>{
      const record=this.teams.get(team.id);
      return !!record&&(!record.offlineVenueId||!!record.claimedAt);
    });
    const location=(id:string)=>this.teamLocations.get(id)??{province:null,district:null};
    const facets={
      provinces:[...new Set(eligible.map(x=>location(x.id).province).filter((v):v is string=>!!v))].sort(),
      cities:[...new Set(eligible.filter(x=>!filters.province||
        location(x.id).province===filters.province).map(x=>x.city))].sort(),
      districts:[...new Set(eligible.filter(x=>
        (!filters.province||location(x.id).province===filters.province)&&
        (!filters.city||x.city===filters.city)).map(x=>location(x.id).district)
        .filter((v):v is string=>!!v))].sort(),
    };
    const q=filters.q.toLowerCase();
    const records=eligible.filter(x=>{
      const geo=location(x.id);
      return (!filters.province||geo.province===filters.province)&&
        (!filters.city||x.city===filters.city)&&
        (!filters.district||geo.district===filters.district)&&
        (!q||[x.name,x.city,geo.province??"",geo.district??""].some(value=>
          value.toLowerCase().includes(q)))&&
        (filters.scope!=="mine"||!!x.myMembershipRole)&&
        (filters.scope!=="following"||this.teamFollowings.has(userId+":"+x.id));
    }).map(x=>({...x,...location(x.id),followerCount:this.teamFollowerCounts.get(x.id)??0}));
    const sort=filters.scope==="popular"?"mostFollowed":filters.sort;
    records.sort((a,b)=>sort==="newest"?
      b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id):
      sort==="alphabetical"?
      a.name.localeCompare(b.name)||a.id.localeCompare(b.id):
      sort==="mostMembers"?
      b.rosterCount-a.rosterCount||b.followerCount-a.followerCount||
        a.name.localeCompare(b.name)||a.id.localeCompare(b.id):
      b.followerCount-a.followerCount||b.rosterCount-a.rosterCount||
        a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
    const total=records.length;
    const teams=records.slice((filters.page-1)*filters.limit,filters.page*filters.limit);
    return {teams,total,page:filters.page,limit:filters.limit,
      hasMore:filters.page*filters.limit<total,facets};
  }

  async allowsJoinRequests(teamId:string){return this.joinRequestsAllowed.get(teamId)??true;}

  async getJoinRequest(teamId:string,requesterUserId:string){
    return [...this.joinRequests.values()].find((request)=>
      request.teamId===teamId&&request.requesterUserId===requesterUserId&&request.status==="PENDING"
    )??null;
  }

  async createJoinRequest(teamId:string,requesterUserId:string,now:Date){
    const team=this.teams.get(teamId);
    const user=this.users.get(requesterUserId);
    if(!team||!user)throw new Error("join request fixture missing");
    const existing=await this.getJoinRequest(teamId,requesterUserId);
    if(existing)return existing;
    const request:TeamJoinRequestDto={
      id:randomUUID(),
      teamId,
      teamName:team.name,
      requesterUserId,
      requesterDisplayName:this.profiles.get(requesterUserId)?.publicDisplayName??user.displayName,
      status:"PENDING",
      createdAt:now.toISOString(),
      respondedAt:null,
    };
    this.joinRequests.set(request.id,request);
    return request;
  }

  async cancelJoinRequest(teamId:string,requesterUserId:string,now:Date,requestId?:string){
    const current=await this.getJoinRequest(teamId,requesterUserId);
    if(!current||(requestId&&current.id!==requestId))return null;
    const cancelled:TeamJoinRequestDto={...current,status:"CANCELLED",
      respondedAt:now.toISOString()};
    this.joinRequests.set(current.id,cancelled);
    return cancelled;
  }

  async listJoinRequestsForTeam(teamId:string){
    return [...this.joinRequests.values()]
      .filter((request)=>request.teamId===teamId)
      .sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }

  async respondJoinRequest(teamId:string,requestId:string,managerUserId:string,accept:boolean,now:Date){
    const team=this.teams.get(teamId);
    const request=this.joinRequests.get(requestId);
    if(!team||team.managerUserId!==managerUserId||!request||request.teamId!==teamId||request.status!=="PENDING")return null;
    const status=accept?"ACCEPTED" as const:"REJECTED" as const;
    const next:TeamJoinRequestDto={...request,status,respondedAt:now.toISOString()};
    this.joinRequests.set(requestId,next);
    if(accept){
      for(const [id,inv] of this.invitations){
        if(inv.teamId===teamId&&inv.invitedUserId===request.requesterUserId&&inv.status==="PENDING"){
          this.invitations.set(id,{...inv,status:"REVOKED"});
        }
      }
      const key=this.membershipKey(teamId,request.requesterUserId);
      const current=this.memberships.get(key);
      this.memberships.set(key,{
        teamId,
        userId:request.requesterUserId,
        role:"PLAYER",
        shirtNumber:current?.shirtNumber??null,
        status:"ACTIVE",
        joinedAt:current?.joinedAt??now,
        leftAt:null,
      });
    }
    return next;
  }

  async listUserTeams(userId: string): Promise<TeamListItemDto[]> {
    const result: TeamListItemDto[] = [];
    for (const membership of this.memberships.values()) {
      if (membership.userId !== userId || membership.status !== "ACTIVE") continue;
      const team = await this.getTeam(membership.teamId, false);
      if (!team || team.status !== "ACTIVE") continue;
      const { members: _members, ...summary } = team;
      result.push(summary);
    }
    return result;
  }

  async getMembership(teamId: string, userId: string) {
    return this.memberships.get(this.membershipKey(teamId, userId)) ?? null;
  }

  async updateTeam(teamId: string, input: {
    name?: string;
    logoUrl?: string | null;
    city?: string;
    privacy?: "PUBLIC" | "PRIVATE";
    updatedAt: Date;
  }) {
    const team = this.teams.get(teamId);
    if (!team) return null;
    this.teams.set(teamId, {
      ...team,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.privacy !== undefined ? { privacy: input.privacy } : {}),
    });
    return this.getTeam(teamId, true);
  }

  async updateMember(teamId: string, userId: string, input: {
    role?: TeamMemberRole;
    shirtNumber?: number | null;
    status?: "ACTIVE" | "REMOVED";
    leftAt?: Date | null;
    updatedAt: Date;
  }) {
    const key = this.membershipKey(teamId, userId);
    const membership = this.memberships.get(key);
    if (!membership) return;
    this.memberships.set(key, {
      ...membership,
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.shirtNumber !== undefined ? { shirtNumber: input.shirtNumber } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.leftAt !== undefined ? { leftAt: input.leftAt } : {}),
    });
  }

  async transferManager(teamId: string, currentManagerUserId: string, nextManagerUserId: string, _now: Date) {
    const team = this.teams.get(teamId);
    const next = this.memberships.get(this.membershipKey(teamId, nextManagerUserId));
    if (!team || team.managerUserId !== currentManagerUserId || next?.status !== "ACTIVE") return null;
    team.managerUserId = nextManagerUserId;
    this.teams.set(teamId, team);
    await this.updateMember(teamId, nextManagerUserId, { role: "MANAGER", updatedAt: new Date() });
    await this.updateMember(teamId, currentManagerUserId, {
      role: team.captainUserId === currentManagerUserId ? "CAPTAIN" : "PLAYER",
      updatedAt: new Date(),
    });
    return this.getTeam(teamId, true);
  }

  async setCaptain(teamId: string, managerUserId: string, captainUserId: string | null, _now: Date) {
    const team = this.teams.get(teamId);
    if (!team || team.managerUserId !== managerUserId) return null;
    if (captainUserId) {
      const membership = this.memberships.get(this.membershipKey(teamId, captainUserId));
      if (membership?.status !== "ACTIVE") return null;
    }
    if (team.captainUserId && team.captainUserId !== team.managerUserId) {
      await this.updateMember(teamId, team.captainUserId, { role: "PLAYER", updatedAt: new Date() });
    }
    team.captainUserId = captainUserId;
    this.teams.set(teamId, team);
    if (captainUserId && captainUserId !== managerUserId) {
      await this.updateMember(teamId, captainUserId, { role: "CAPTAIN", updatedAt: new Date() });
    }
    return this.getTeam(teamId, true);
  }

  async removeMember(teamId: string, managerUserId: string, memberUserId: string, now: Date) {
    const team = this.teams.get(teamId);
    const membership = this.memberships.get(this.membershipKey(teamId, memberUserId));
    if (!team || team.managerUserId !== managerUserId || memberUserId === managerUserId || membership?.status !== "ACTIVE") return null;
    if (team.captainUserId === memberUserId) team.captainUserId = null;
    this.teams.set(teamId, team);
    await this.updateMember(teamId, memberUserId, { status: "REMOVED", leftAt: now, updatedAt: now });
    return this.getTeam(teamId, true);
  }

  async createInvitation(input: {
    teamId: string;
    invitedUserId: string;
    invitedByUserId: string;
    role: "CAPTAIN" | "PLAYER";
    shirtNumber: number | null;
    expiresAt: Date;
    now: Date;
  }) {
    const duplicate = [...this.invitations.values()].find((item) =>
      item.teamId === input.teamId &&
      item.invitedUserId === input.invitedUserId &&
      item.status === "PENDING"
    );
    if (duplicate) throw errors.conflict("TEAM_INVITATION_PENDING", "A pending invitation already exists for this player.");

    const team = this.teams.get(input.teamId)!;
    const user = this.users.get(input.invitedUserId)!;
    const profile = this.profiles.get(input.invitedUserId);
    const invitation: TeamInvitationDto = {
      id: randomUUID(),
      teamId: input.teamId,
      teamName: team.name,
      invitedUserId: input.invitedUserId,
      invitedPublicDisplayName: profile?.publicDisplayName ?? user.displayName,
      role: input.role,
      shirtNumber: input.shirtNumber,
      status: "PENDING",
      expiresAt: input.expiresAt.toISOString(),
      createdAt: input.now.toISOString(),
    };
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  async listInvitationsForUser(userId: string, now: Date) {
    for (const [id, invite] of this.invitations) {
      if (invite.status === "PENDING" && Date.parse(invite.expiresAt) <= now.getTime()) {
        this.invitations.set(id, { ...invite, status: "EXPIRED" });
      }
    }
    return [...this.invitations.values()]
      .filter((invite) => invite.invitedUserId === userId)
      .sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listInvitationsForTeam(teamId: string, now: Date) {
    for (const [id, invite] of this.invitations) {
      if (invite.status === "PENDING" && Date.parse(invite.expiresAt) <= now.getTime()) {
        this.invitations.set(id, { ...invite, status: "EXPIRED" });
      }
    }
    return [...this.invitations.values()]
      .filter((invite) => invite.teamId === teamId)
      .sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }

  async acceptInvitation(invitationId: string, invitedUserId: string, now: Date) {
    const invite = this.invitations.get(invitationId);
    if (!invite || invite.invitedUserId !== invitedUserId || invite.status !== "PENDING") return null;
    if (Date.parse(invite.expiresAt) <= now.getTime()) {
      const expired = { ...invite, status: "EXPIRED" as const };
      this.invitations.set(invitationId, expired);
      return null;
    }

    const team=this.teams.get(invite.teamId);
    if(!team||team.status!=="ACTIVE"||(team.offlineVenueId&&!team.claimedAt)){
      this.invitations.set(invitationId,{...invite,status:"REVOKED"});
      return null;
    }
    if(this.users.get(invitedUserId)?.roles.includes("REFEREE"))
      throw errors.conflict("REFEREE_ROLE_EXCLUSIVE","Referees cannot join teams.");
    const key = this.membershipKey(invite.teamId, invitedUserId);
    const existing = this.memberships.get(key);
    if(existing?.status==="ACTIVE"){
      this.invitations.set(invitationId,{...invite,status:"REVOKED"});
      return null;
    }
    this.memberships.set(key, {
      teamId: invite.teamId,
      userId: invitedUserId,
      role: invite.role,
      shirtNumber: invite.shirtNumber,
      status: "ACTIVE",
      joinedAt: existing?.joinedAt ?? now,
      leftAt: null,
    });

    if (invite.role === "CAPTAIN") {
      const team = this.teams.get(invite.teamId)!;
      if (team.captainUserId && team.captainUserId !== team.managerUserId && team.captainUserId !== invitedUserId) {
        await this.updateMember(invite.teamId, team.captainUserId, { role: "PLAYER", updatedAt: now });
      }
      team.captainUserId = invitedUserId;
      this.teams.set(invite.teamId, team);
    }

    for(const [id,pending] of this.joinRequests){
      if(pending.teamId===invite.teamId&&pending.requesterUserId===invitedUserId&&pending.status==="PENDING"){
        this.joinRequests.set(id,{...pending,status:"ACCEPTED",respondedAt:now.toISOString()});
      }
    }
    const accepted = { ...invite, status: "ACCEPTED" as const };
    this.invitations.set(invitationId, accepted);
    return accepted;
  }

  async declineInvitation(invitationId: string, invitedUserId: string, _now: Date) {
    const invite = this.invitations.get(invitationId);
    if (!invite || invite.invitedUserId !== invitedUserId || invite.status !== "PENDING") return null;
    const declined = { ...invite, status: "DECLINED" as const };
    this.invitations.set(invitationId, declined);
    return declined;
  }

  async revokeInvitation(teamId: string, managerUserId: string, invitationId: string, _now: Date) {
    const team = this.teams.get(teamId);
    const invite = this.invitations.get(invitationId);
    if (!team || team.managerUserId !== managerUserId || !invite || invite.teamId !== teamId || invite.status !== "PENDING") return null;
    const revoked = { ...invite, status: "REVOKED" as const };
    this.invitations.set(invitationId, revoked);
    return revoked;
  }

}
