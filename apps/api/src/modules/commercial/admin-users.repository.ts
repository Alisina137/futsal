import type { Database } from "@leaguekick/database";
import { auditLogs, bookings, playerProfiles, roleSubscriptions, sessions, teamExtraSubscriptions, teamMemberships, teams, userRoles, users, venueReferees, venueSubscriptions, venues } from "@leaguekick/database";
import { and, asc, desc, eq, gt, ilike, isNull, or, sql } from "drizzle-orm";
import { adminUserDetailDtoSchema } from "@leaguekick/contracts";
import type { AdminUserDirectoryFilter, AdminUserDto, UserRole } from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";

/** Read-only role diagnostics: role authority remains with the existing owner,
 * team, billing, and platform-admin workflows. Never auto-repair conflicts. */
export class DrizzleAdminUsersRepository {
  constructor(private readonly db: Database) {}

  private roleWhere(role:AdminUserDirectoryFilter["role"]){
    const explicit=sql`exists (select 1 from user_roles ur where ur.user_id=${users.id})`;
    if(role==="NORMAL_USER")return sql`not ${explicit}
      and not exists (select 1 from venue_referees vr where vr.user_id=${users.id})
      and not exists (select 1 from player_profiles pp where pp.user_id=${users.id})
      and not exists (select 1 from team_memberships tm where tm.user_id=${users.id} and tm.status='ACTIVE')
      and not exists (select 1 from teams t where t.manager_user_id=${users.id})
      and not exists (select 1 from venues v where v.owner_user_id=${users.id})`;
    if(role==="REFEREE")return sql`(
      exists (select 1 from venue_referees vr where vr.user_id=${users.id})
      or exists (select 1 from user_roles ur where ur.user_id=${users.id} and ur.role='REFEREE'))`;
    if(role==="PLAYER")return sql`(
      exists (select 1 from user_roles ur where ur.user_id=${users.id} and ur.role='PLAYER')
      or exists (select 1 from player_profiles pp where pp.user_id=${users.id})
      or exists (select 1 from team_memberships tm where tm.user_id=${users.id} and tm.status='ACTIVE'))`;
    if(role==="VENUE_OWNER"||role==="TEAM_MANAGER")return sql`(
      exists (select 1 from user_roles ur where ur.user_id=${users.id} and ur.role=${role})
      or exists (select 1 from role_subscriptions rs where rs.user_id=${users.id}
        and rs.role=${role} and rs.status='ACTIVE' and rs.active_until > now()))`;
    return sql`exists (select 1 from user_roles ur where ur.user_id=${users.id} and ur.role=${role})`;
  }
  private where(query:string|undefined,filters:AdminUserDirectoryFilter){
    const q=query?.trim();
    return and(
      q?or(ilike(users.displayName,`%${q}%`),ilike(users.username,`%${q}%`),ilike(users.phoneE164,`%${q}%`)):undefined,
      filters.status?eq(users.status,filters.status):undefined,
      filters.city?ilike(users.city,`%${filters.city}%`):undefined,
      filters.role?this.roleWhere(filters.role):undefined,
    );
  }
  async countUsers(query:string|undefined,filters:AdminUserDirectoryFilter){
    const [row]=await this.db.select({total:sql<number>`count(*)::int`})
      .from(users).where(this.where(query,filters));
    return row?.total??0;
  }
  async listUsers(query:string|undefined,page:number,pageSize:number,sort:"newest"|"oldest",filters:AdminUserDirectoryFilter):Promise<AdminUserDto[]>{
    const rows=await this.db.select().from(users).where(this.where(query,filters))
      .orderBy(sort==="oldest"?asc(users.createdAt):desc(users.createdAt),asc(users.id))
      .limit(pageSize).offset((page-1)*pageSize);
    return Promise.all(rows.map(async row=>{
      const [stored,refs,paid]=await Promise.all([
        this.db.select({role:userRoles.role}).from(userRoles).where(eq(userRoles.userId,row.id)),
        this.db.select({userId:venueReferees.userId}).from(venueReferees).where(eq(venueReferees.userId,row.id)).limit(1),
        this.db.select({role:roleSubscriptions.role,status:roleSubscriptions.status,activeUntil:roleSubscriptions.activeUntil})
          .from(roleSubscriptions).where(eq(roleSubscriptions.userId,row.id)),
      ]);
      const activePaid=new Set(paid.filter(s=>s.status==="ACTIVE"&&!!s.activeUntil&&s.activeUntil.getTime()>Date.now()).map(s=>s.role));
      const roles=stored.map(s=>s.role).filter(r=>(r!=="TEAM_MANAGER"&&r!=="VENUE_OWNER")||activePaid.has(r));
      if(refs.length&&!roles.includes("REFEREE"))roles.push("REFEREE");
      return {id:row.id,displayName:row.displayName,username:row.username,phone:row.phoneE164??"",
        status:row.status,roles,createdAt:row.createdAt.toISOString()};
    }));
  }

  async detail(userId:string){
    const [user]=await this.db.select().from(users).where(eq(users.id,userId)).limit(1);
    if(!user)return null;
    const [stored,paid,extras,owned,managed,members,refs,profile,reservations,activity,sessionRows]=await Promise.all([
      this.db.select().from(userRoles).where(eq(userRoles.userId,userId)),
      this.db.select().from(roleSubscriptions).where(eq(roleSubscriptions.userId,userId)),
      this.db.select().from(teamExtraSubscriptions).where(eq(teamExtraSubscriptions.userId,userId)).limit(60),
      this.db.select({id:venues.id,name:venues.name,status:venues.status,subscription:venueSubscriptions.status,
        activeUntil:venueSubscriptions.activeUntil}).from(venues)
        .leftJoin(venueSubscriptions,eq(venues.id,venueSubscriptions.venueId))
        .where(eq(venues.ownerUserId,userId)).limit(60),
      this.db.select({id:teams.id,name:teams.name,status:teams.status})
        .from(teams).where(eq(teams.managerUserId,userId)).limit(60),
      this.db.select({id:teams.id,name:teams.name,status:teamMemberships.status,role:teamMemberships.role})
        .from(teamMemberships).innerJoin(teams,eq(teamMemberships.teamId,teams.id))
        .where(eq(teamMemberships.userId,userId)).limit(60),
      this.db.select({venueId:venueReferees.venueId,assignedAt:venueReferees.assignedAt,name:venues.name})
        .from(venueReferees).innerJoin(venues,eq(venueReferees.venueId,venues.id))
        .where(eq(venueReferees.userId,userId)).limit(50),
      this.db.select({userId:playerProfiles.userId}).from(playerProfiles).where(eq(playerProfiles.userId,userId)).limit(1),
      this.db.select({id:bookings.id,venueName:venues.name,startsAt:bookings.startsAt,
        source:bookings.source,status:bookings.status,priceAfn:bookings.priceAfn})
        .from(bookings).innerJoin(venues,eq(bookings.venueId,venues.id))
        .where(or(eq(bookings.playerUserId,userId),eq(bookings.createdByUserId,userId)))
        .orderBy(desc(bookings.startsAt)).limit(40),
      this.db.select().from(auditLogs)
        .where(and(eq(auditLogs.targetType,"USER"),eq(auditLogs.targetId,userId)))
        .orderBy(desc(auditLogs.createdAt)).limit(60),
      this.db.select({revokedAt:sessions.revokedAt,expiresAt:sessions.expiresAt})
        .from(sessions).where(eq(sessions.userId,userId)).limit(10000),
    ]);
    const now=Date.now();
    const activePaid=new Set(paid.filter(p=>p.status==="ACTIVE"&&!!p.activeUntil&&p.activeUntil.getTime()>now).map(p=>p.role));
    const effectiveRoles=stored.map(s=>s.role)
      .filter(r=>(r!=="VENUE_OWNER"&&r!=="TEAM_MANAGER")||activePaid.has(r));
    if(refs.length&&!effectiveRoles.includes("REFEREE"))effectiveRoles.push("REFEREE");
    const provenance=[
      ...stored.map(s=>({role:s.role,source:"EXPLICIT" as const,detail:null,assignedAt:s.assignedAt.toISOString()})),
      ...refs.map(ref=>({role:"REFEREE" as const,source:"VENUE_ASSIGNMENT" as const,
        detail:ref.name,assignedAt:ref.assignedAt.toISOString()})),
      ...paid.filter(p=>activePaid.has(p.role)).map(p=>({role:p.role,source:"PAID_SUBSCRIPTION" as const,
        detail:p.status,assignedAt:p.activatedAt?.toISOString()??null})),
    ];
    const conflicts:string[]=[];
    const activeMember=members.some(m=>m.status==="ACTIVE");
    if(refs.length||effectiveRoles.includes("REFEREE")){
      if(profile.length||activeMember||managed.length||owned.length||
        stored.some(r=>r.role!=="REFEREE")||activePaid.size)
        conflicts.push("REFEREE_ACCOUNT_HAS_OTHER_ROLE_OR_PLAYER_TEAM_VENUE_ASSIGNMENT");
      if(!refs.length)conflicts.push("REFEREE_ROLE_WITHOUT_VENUE_ASSIGNMENT");
    }
    for(const role of ["TEAM_MANAGER","VENUE_OWNER"] as const){
      if(stored.some(r=>r.role===role)&&!activePaid.has(role))
        conflicts.push(role+"_GRANT_WITHOUT_ACTIVE_PAID_SUBSCRIPTION");
    }
    const teamMap=new Map<string,{id:string;name:string;relationship:string;status:string}>();
    for(const team of managed)teamMap.set(team.id,{id:team.id,name:team.name,relationship:"MANAGER",status:team.status});
    for(const team of members)if(!teamMap.has(team.id))teamMap.set(team.id,{
      id:team.id,name:team.name,relationship:team.role,status:team.status});
    const result={
      user:{id:user.id,displayName:user.displayName,username:user.username,phone:user.phoneE164,
        status:user.status,roles:effectiveRoles,createdAt:user.createdAt.toISOString(),
        city:user.city,updatedAt:user.updatedAt.toISOString()},
      effectiveRoles,roleProvenance:provenance,conflicts,
      subscriptions:[
        ...paid.map(p=>({kind:"PAID_ROLE",role:p.role,status:p.status,activeUntil:p.activeUntil?.toISOString()??null})),
        ...extras.map(e=>({kind:"EXTRA_TEAM",role:"TEAM_MANAGER",status:e.status,activeUntil:e.activeUntil?.toISOString()??null})),
        ...owned.map(v=>({kind:"VENUE",role:v.name,status:v.subscription??"NOT_STARTED",activeUntil:v.activeUntil?.toISOString()??null})),
      ],
      teams:[...teamMap.values()],
      reservations:reservations.map(b=>({...b,startsAt:b.startsAt.toISOString()})),
      activity:activity.map(a=>({id:a.id,action:a.action,actorUserId:a.actorUserId,
        createdAt:a.createdAt.toISOString(),metadata:a.metadata})),
      sessions:{active:sessionRows.filter(s=>!s.revokedAt&&s.expiresAt.getTime()>now).length,total:sessionRows.length},
    };
    return adminUserDetailDtoSchema.parse(result);
  }

  async setStatus(actorUserId:string,userId:string,status:"ACTIVE"|"SUSPENDED",reason:string,now:Date){
    if(actorUserId===userId&&status==="SUSPENDED")
      throw errors.badRequest("ADMIN_SELF_SUSPEND","You cannot suspend your own admin account.");
    await this.db.transaction(async tx=>{
      const [prior]=await tx.select({status:users.status}).from(users).where(eq(users.id,userId)).for("update").limit(1);
      if(!prior)throw errors.badRequest("USER_NOT_FOUND","User not found.");
      if(prior.status==="DELETED")throw errors.badRequest("USER_DELETED","Deleted accounts cannot be restored.");
      if(prior.status===status)throw errors.badRequest("NO_STATUS_CHANGE","Account already has this status.");
      await tx.update(users).set({status,updatedAt:now,...(status==="SUSPENDED"?{sessionsRevokedAt:now}:{})})
        .where(eq(users.id,userId));
      if(status==="SUSPENDED")await tx.update(sessions).set({revokedAt:now,lastSeenAt:now})
        .where(and(eq(sessions.userId,userId),isNull(sessions.revokedAt)));
      await tx.insert(auditLogs).values({actorUserId,action:status==="SUSPENDED"?"USER_SUSPENDED":"USER_RESTORED",
        targetType:"USER",targetId:userId,metadata:{reason,previousStatus:prior.status,sessionsRevoked:status==="SUSPENDED"},
        createdAt:now});
    });
  }

  async revokeSessions(actorUserId:string,userId:string,reason:string,now:Date){
    await this.db.transaction(async tx=>{
      const [target]=await tx.select({id:users.id}).from(users).where(eq(users.id,userId)).for("update").limit(1);
      if(!target)throw errors.badRequest("USER_NOT_FOUND","User not found.");
      await tx.update(users).set({sessionsRevokedAt:now,updatedAt:now}).where(eq(users.id,userId));
      await tx.update(sessions).set({revokedAt:now,lastSeenAt:now})
        .where(and(eq(sessions.userId,userId),isNull(sessions.revokedAt)));
      await tx.insert(auditLogs).values({actorUserId,action:"USER_SESSIONS_REVOKED",
        targetType:"USER",targetId:userId,metadata:{reason},createdAt:now});
    });
  }

  async addNote(actorUserId:string,userId:string,note:string,reason:string,now:Date){
    await this.db.transaction(async tx=>{
      const [target]=await tx.select({id:users.id}).from(users).where(eq(users.id,userId)).limit(1);
      if(!target)throw errors.badRequest("USER_NOT_FOUND","User not found.");
      await tx.insert(auditLogs).values({actorUserId,action:"USER_NOTE_ADDED",
        targetType:"USER",targetId:userId,metadata:{reason,note},createdAt:now});
    });
  }
}
