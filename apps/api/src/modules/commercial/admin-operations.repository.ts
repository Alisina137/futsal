import type { Database } from "@leaguekick/database";
import {
  adminCases,auditLogs,bookings,competitionMatches,competitionTeams,competitions,
  playerProfiles,roleSubscriptions,teamExtraSubscriptions,teamMemberships,teams,
  userRoles,users,venueAreas,venueReferees,venueSubscriptions,venueTimetablePeriods,
  venueTimetables,venues,
} from "@leaguekick/database";
import type { AdminCaseDto, AdminOperationDetail, AdminOperationFilters, AdminOperationItem, AdminOperationKind } from "@leaguekick/contracts";
import { and,asc,desc,eq,gt,gte,ilike,isNull,lt,ne,or,sql } from "drizzle-orm";
import { errors } from "../../lib/errors.js";

type CaseType=AdminOperationKind;
type CaseState="OPEN"|"UNDER_REVIEW"|"RESOLVED";
const fmt=(x:Date|null|undefined)=>x?.toISOString()??null;
const label=(v:unknown)=>v==null?"—":String(v);
const fact=(key:string,v:unknown)=>({label:key,value:label(v)});
const record=(id:string,primary:string,secondary="",status:string|null=null)=>({id,primary,secondary,status});
function boundFrom(from:string|undefined){return from?new Date(from+"T00:00:00+04:30"):null;}
function boundUntil(to:string|undefined){return to?new Date(new Date(to+"T00:00:00+04:30").getTime()+86400000):null;}
function dateScope(column:typeof bookings.startsAt|typeof competitions.createdAt|typeof venues.createdAt|typeof teams.createdAt|typeof users.createdAt, f:AdminOperationFilters){
  return and(f.from?gte(column,boundFrom(f.from)!):undefined,f.to?lt(column,boundUntil(f.to)!):undefined);
}
function page<T extends {items:AdminOperationItem[];total:number}>(v:T,f:AdminOperationFilters){
  return {...v,page:f.page,pageSize:f.pageSize,hasMore:f.page*f.pageSize<v.total};
}
const normalize=(v:string)=>v.trim().toLowerCase().replace(/\s+/g," ");
function caseDto(row:typeof adminCases.$inferSelect):AdminCaseDto{
  return {id:row.id,targetType:row.targetType as CaseType,targetId:row.targetId,
    state:row.state as CaseState,reason:row.reason,note:row.note,openedByUserId:row.openedByUserId,
    openedAt:row.openedAt.toISOString(),updatedAt:row.updatedAt.toISOString(),closedAt:fmt(row.closedAt)};
}
function isUnique(e:unknown){
  if(typeof e!=="object"||e===null)return false;
  const any=e as {code?:string;cause?:{code?:string}};
  return any.code==="23505"||any.cause?.code==="23505";
}

export class DrizzleAdminOperationsRepository {
  constructor(private readonly db:Database){}
  async list(kind:AdminOperationKind,f:AdminOperationFilters){
    const offset=(f.page-1)*f.pageSize;
    const order=(col:typeof venues.createdAt|typeof teams.createdAt|typeof competitions.createdAt|typeof users.createdAt|typeof bookings.createdAt)=>
      [f.sort==="oldest"?asc(col):desc(col)] as const;
    if(kind==="VENUE"){
      const cond=and(f.q?or(ilike(venues.name,`%${f.q}%`),ilike(venues.city,`%${f.q}%`),ilike(users.displayName,`%${f.q}%`)):undefined,
        f.status?sql`${venues.status}=${f.status}`:undefined,
        f.verification?eq(venues.verificationStatus,f.verification):undefined,
        f.venueId?eq(venues.id,f.venueId):undefined,dateScope(venues.createdAt,f));
      const [records,totals]=await Promise.all([
        this.db.select({id:venues.id,name:venues.name,city:venues.city,province:venues.province,
          owner:users.displayName,status:venues.status,verified:venues.verificationStatus,
          created:venues.createdAt}).from(venues).innerJoin(users,eq(venues.ownerUserId,users.id))
          .where(cond).orderBy(...order(venues.createdAt),asc(venues.id)).limit(f.pageSize).offset(offset),
        this.db.select({count:sql<number>`count(*)::int`}).from(venues)
          .innerJoin(users,eq(venues.ownerUserId,users.id)).where(cond),
      ]);
      return page({items:records.map(row=>({
        id:row.id,kind,title:row.name,subtitle:row.city+" · "+row.province,status:row.status,
        secondaryStatus:row.verified,ownerName:row.owner,venueName:row.name,
        location:row.city+", "+row.province,startsAt:null,createdAt:row.created.toISOString(),
        warningCount:row.verified==="PENDING"?1:0,
      })),total:totals[0]?.count??0},f);
    }
    if(kind==="TEAM"){
      const cond=and(f.q?or(ilike(teams.name,`%${f.q}%`),ilike(teams.city,`%${f.q}%`),
        ilike(users.displayName,`%${f.q}%`)):undefined,
        f.status?sql`${teams.status}=${f.status}`:undefined,
        f.venueId?eq(teams.offlineVenueId,f.venueId):undefined,dateScope(teams.createdAt,f));
      const [records,totals]=await Promise.all([
        this.db.select({id:teams.id,name:teams.name,city:teams.city,status:teams.status,
          manager:users.displayName,privacy:teams.privacy,created:teams.createdAt})
          .from(teams).innerJoin(users,eq(teams.managerUserId,users.id)).where(cond)
          .orderBy(...order(teams.createdAt),asc(teams.id)).limit(f.pageSize).offset(offset),
        this.db.select({count:sql<number>`count(*)::int`}).from(teams)
          .innerJoin(users,eq(teams.managerUserId,users.id)).where(cond),
      ]);
      return page({items:records.map(row=>({
        id:row.id,kind,title:row.name,subtitle:row.city,status:row.status,
        secondaryStatus:row.privacy,ownerName:row.manager,venueName:null,location:row.city,
        startsAt:null,createdAt:row.created.toISOString(),warningCount:0,
      })),total:totals[0]?.count??0},f);
    }
    if(kind==="COMPETITION"){
      const cond=and(f.q?or(ilike(competitions.name,`%${f.q}%`),ilike(venues.name,`%${f.q}%`),
        ilike(users.displayName,`%${f.q}%`)):undefined,
        f.status?sql`${competitions.status}=${f.status}`:undefined,
        f.venueId?eq(competitions.venueId,f.venueId):undefined,dateScope(competitions.createdAt,f));
      const join=()=>this.db.select({id:competitions.id,name:competitions.name,
        format:competitions.format,status:competitions.status,owner:users.displayName,
        venue:venues.name,city:venues.city,startsAt:competitions.startsAt,
        created:competitions.createdAt})
        .from(competitions).innerJoin(venues,eq(competitions.venueId,venues.id))
        .innerJoin(users,eq(competitions.createdByUserId,users.id));
      const [records,totals]=await Promise.all([
        join().where(cond).orderBy(...order(competitions.createdAt),asc(competitions.id))
          .limit(f.pageSize).offset(offset),
        this.db.select({count:sql<number>`count(*)::int`}).from(competitions)
          .innerJoin(venues,eq(competitions.venueId,venues.id))
          .innerJoin(users,eq(competitions.createdByUserId,users.id)).where(cond),
      ]);
      return page({items:records.map(row=>({
        id:row.id,kind,title:row.name,subtitle:row.format,status:row.status,
        secondaryStatus:row.format,ownerName:row.owner,venueName:row.venue,location:row.city,
        startsAt:fmt(row.startsAt),createdAt:row.created.toISOString(),warningCount:0,
      })),total:totals[0]?.count??0},f);
    }
    if(kind==="REFEREE"){
      const anyRef=sql`(exists (select 1 from venue_referees vr where vr.user_id=${users.id})
        or exists (select 1 from user_roles ur where ur.user_id=${users.id} and ur.role='REFEREE'))`;
      const cond=and(anyRef,
        f.q?or(ilike(users.displayName,`%${f.q}%`),ilike(users.username,`%${f.q}%`),
          ilike(users.phoneE164,`%${f.q}%`)):undefined,
        f.status?sql`${users.status}=${f.status}`:undefined,
        f.venueId?sql`exists (select 1 from venue_referees vr where vr.user_id=${users.id} and vr.venue_id=${f.venueId})`:undefined,
        dateScope(users.createdAt,f));
      const [records,totals]=await Promise.all([
        this.db.select({id:users.id,name:users.displayName,username:users.username,
          city:users.city,status:users.status,created:users.createdAt})
          .from(users).where(cond).orderBy(...order(users.createdAt),asc(users.id))
          .limit(f.pageSize).offset(offset),
        this.db.select({count:sql<number>`count(*)::int`}).from(users).where(cond),
      ]);
      return page({items:records.map(row=>({
        id:row.id,kind,title:row.name,subtitle:row.username?"@"+row.username:"Referee",
        status:row.status,secondaryStatus:null,ownerName:row.name,venueName:null,
        location:row.city,startsAt:null,createdAt:row.created.toISOString(),warningCount:0,
      })),total:totals[0]?.count??0},f);
    }
    const cond=and(
      f.q?or(ilike(venues.name,`%${f.q}%`),ilike(bookings.customerName,`%${f.q}%`),
        sql`cast(${bookings.id} as text) ilike ${"%"+f.q+"%"}`):undefined,
      f.status?sql`${bookings.status}=${f.status}`:undefined,
      f.venueId?eq(bookings.venueId,f.venueId):undefined,dateScope(bookings.startsAt,f));
    const [records,totals]=await Promise.all([
      this.db.select({id:bookings.id,venue:venues.name,city:venues.city,
        customer:bookings.customerName,startsAt:bookings.startsAt,createdAt:bookings.createdAt,
        status:bookings.status,source:bookings.source,price:bookings.priceAfn})
        .from(bookings).innerJoin(venues,eq(bookings.venueId,venues.id))
        .where(cond).orderBy(f.sort==="oldest"?asc(bookings.startsAt):desc(bookings.startsAt),asc(bookings.id))
        .limit(f.pageSize).offset(offset),
      this.db.select({count:sql<number>`count(*)::int`}).from(bookings)
        .innerJoin(venues,eq(bookings.venueId,venues.id)).where(cond),
    ]);
    return page({items:records.map(row=>({
      id:row.id,kind,title:row.customer||"Reservation "+row.id.slice(0,8),
      subtitle:"AFN "+row.price+" · "+row.source,status:row.status,secondaryStatus:row.source,
      ownerName:null,venueName:row.venue,location:row.city,
      startsAt:row.startsAt.toISOString(),createdAt:row.createdAt.toISOString(),warningCount:0,
    })),total:totals[0]?.count??0},f);
  }

  private async find(kind:AdminOperationKind,id:string):Promise<AdminOperationItem|null>{
    void kind; void id;
    return null;
  }

  async detail(kind:AdminOperationKind,id:string):Promise<AdminOperationDetail|null>{
    const rows=await this.listDetailSeed(kind,id);
    if(!rows)return null;
    const {item,facts,groups,warnings}=rows;
    return {item,facts,groups,warnings};
  }

  private async listDetailSeed(kind:AdminOperationKind,id:string):Promise<AdminOperationDetail|null>{
    if(kind==="VENUE"){
      const [v]=await this.db.select({venue:venues,owner:users.displayName,ownerPhone:users.phoneE164,
        sub:venueSubscriptions}).from(venues).innerJoin(users,eq(users.id,venues.ownerUserId))
        .leftJoin(venueSubscriptions,eq(venueSubscriptions.venueId,venues.id))
        .where(eq(venues.id,id)).limit(1);
      if(!v)return null;
      const [courts,calendars,latestBookings,referees]=await Promise.all([
        this.db.select({name:venueAreas.name,active:venueAreas.active,base:venueAreas.basePriceAfn})
          .from(venueAreas).where(eq(venueAreas.venueId,id)).limit(12),
        this.db.select({id:venueTimetables.id,name:venueTimetables.name,
          status:venueTimetables.status,from:venueTimetables.effectiveFrom,
          until:venueTimetables.effectiveUntil})
          .from(venueTimetables).where(eq(venueTimetables.venueId,id))
          .orderBy(desc(venueTimetables.createdAt)).limit(10),
        this.db.select({id:bookings.id,startsAt:bookings.startsAt,status:bookings.status,
          source:bookings.source,price:bookings.priceAfn}).from(bookings)
          .where(eq(bookings.venueId,id)).orderBy(desc(bookings.startsAt)).limit(20),
        this.db.select({id:users.id,name:users.displayName,status:users.status})
          .from(venueReferees).innerJoin(users,eq(venueReferees.userId,users.id))
          .where(eq(venueReferees.venueId,id)).limit(30),
      ]);
      const warnings=[
        ...(courts.filter(c=>c.active).length!==1?["Active court count is not one. Review the one-court-per-venue rule."]:[]),
        ...(v.venue.verificationStatus==="PENDING"?["Venue is awaiting verification."]:[]),
      ];
      return {item:{id,kind,title:v.venue.name,subtitle:v.venue.city+" · "+v.venue.province,
        status:v.venue.status,secondaryStatus:v.venue.verificationStatus,ownerName:v.owner,
        venueName:v.venue.name,location:v.venue.address,startsAt:null,
        createdAt:v.venue.createdAt.toISOString(),warningCount:warnings.length},
        facts:[fact("Owner",v.owner),fact("Owner phone",v.ownerPhone),fact("Venue address",v.venue.address),
          fact("Province",v.venue.province),fact("Geo",v.venue.latitude!=null?v.venue.latitude+", "+v.venue.longitude:null),
          fact("Verification",v.venue.verificationStatus),fact("Subscription",v.sub?.status??"NOT_STARTED"),
          fact("Trial expiry",fmt(v.sub?.trialEndsAt)),fact("Paid until",fmt(v.sub?.activeUntil)),
          fact("Online booking",v.venue.onlineBookingEnabled?"Enabled":"Disabled"),fact("Booking mode",v.venue.bookingMode)],
        groups:[
          {title:"Courts (one active court required)",rows:courts.map((c,i)=>record(String(i),c.name,"Base AFN "+c.base,c.active?"ACTIVE":"INACTIVE"))},
          {title:"Timetables",rows:calendars.map(t=>record(t.id,t.name,t.from+" – "+(t.until||"open"),t.status))},
          {title:"Recent reservations",rows:latestBookings.map(b=>record(b.id,b.startsAt.toISOString(),"AFN "+b.price+" · "+b.source,b.status))},
          {title:"Assigned referees",rows:referees.map(r=>record(r.id,r.name,"",r.status))},
        ],warnings};
    }
    if(kind==="TEAM"){
      const [t]=await this.db.select({team:teams,manager:users.displayName})
        .from(teams).innerJoin(users,eq(teams.managerUserId,users.id))
        .where(eq(teams.id,id)).limit(1);
      if(!t)return null;
      const [roster,registered,paid]=await Promise.all([
        this.db.select({userId:users.id,name:users.displayName,
          role:teamMemberships.role,status:teamMemberships.status})
          .from(teamMemberships).innerJoin(users,eq(users.id,teamMemberships.userId))
          .where(eq(teamMemberships.teamId,id)).limit(75),
        this.db.select({id:competitions.id,name:competitions.name,status:competitions.status,
          fee:competitionTeams.feeStatus})
          .from(competitionTeams).innerJoin(competitions,eq(competitions.id,competitionTeams.competitionId))
          .where(eq(competitionTeams.teamId,id)).limit(50),
        this.db.select({role:roleSubscriptions.role,status:roleSubscriptions.status,
          until:roleSubscriptions.activeUntil}).from(roleSubscriptions)
          .where(and(eq(roleSubscriptions.userId,t.team.managerUserId),eq(roleSubscriptions.role,"TEAM_MANAGER"))).limit(1),
      ]);
      const warnings=[
        ...(t.team.status==="ACTIVE"&&paid.some(p=>p.status!=="ACTIVE"||!p.until||p.until.getTime()<=Date.now())
          ?["Manager subscription is not active; confirm team-specific entitlements."]:[]),
      ];
      return {item:{id,kind,title:t.team.name,subtitle:t.team.city,status:t.team.status,
        secondaryStatus:t.team.privacy,ownerName:t.manager,venueName:null,location:t.team.city,
        startsAt:null,createdAt:t.team.createdAt.toISOString(),warningCount:warnings.length},
        facts:[fact("Manager",t.manager),fact("Manager user ID",t.team.managerUserId),
          fact("Privacy",t.team.privacy),fact("Offline venue ID",t.team.offlineVenueId),
          fact("Claimed at",fmt(t.team.claimedAt)),fact("Manager subscription",paid[0]?.status??"NONE"),
          fact("Manager role paid until",fmt(paid[0]?.until)),fact("Roster (shown)",roster.length)],
        groups:[{title:"Team roster",rows:roster.map(r=>record(r.userId,r.name,r.role,r.status))},
          {title:"Competitions",rows:registered.map(r=>record(r.id,r.name,"Fee: "+r.fee,r.status))}],
        warnings};
    }
    if(kind==="COMPETITION"){
      const [c]=await this.db.select({competition:competitions,venue:venues.name,
        city:venues.city,owner:users.displayName}).from(competitions)
        .innerJoin(venues,eq(venues.id,competitions.venueId))
        .innerJoin(users,eq(users.id,competitions.createdByUserId))
        .where(eq(competitions.id,id)).limit(1);
      if(!c)return null;
      const [registrations,matches]=await Promise.all([
        this.db.select({id:teams.id,name:teams.name,status:competitionTeams.status,
          fee:competitionTeams.feeStatus}).from(competitionTeams)
          .innerJoin(teams,eq(teams.id,competitionTeams.teamId))
          .where(eq(competitionTeams.competitionId,id)).limit(90),
        this.db.select({id:competitionMatches.id,stage:competitionMatches.stage,
          status:competitionMatches.status,startsAt:competitionMatches.startsAt,
          homeId:competitionMatches.homeTeamId,awayId:competitionMatches.awayTeamId,
          homeScore:competitionMatches.homeScore,awayScore:competitionMatches.awayScore})
          .from(competitionMatches).where(eq(competitionMatches.competitionId,id))
          .orderBy(asc(competitionMatches.roundNumber),asc(competitionMatches.slotNumber)).limit(110),
      ]);
      const accepted=registrations.filter(r=>r.status==="ACCEPTED").length;
      const warnings=[
        ...(accepted>c.competition.maxTeams?["Accepted teams exceed competition capacity."]:[]),
        ...(c.competition.status==="IN_PROGRESS"&&matches.some(m=>m.status==="UNSCHEDULED")
          ?["Competition has unscheduled matches while in progress."]:[]),
        ...(matches.some(m=>m.status==="COMPLETED"&&(m.homeScore===null||m.awayScore===null))
          ?["Completed match without both scores: investigate result consistency."]:[]),
      ];
      return {item:{id,kind,title:c.competition.name,subtitle:c.competition.format,
        status:c.competition.status,secondaryStatus:c.competition.format,ownerName:c.owner,
        venueName:c.venue,location:c.city,startsAt:fmt(c.competition.startsAt),
        createdAt:c.competition.createdAt.toISOString(),warningCount:warnings.length},
        facts:[fact("Organizer",c.owner),fact("Venue",c.venue),fact("Format",c.competition.format),
          fact("Max teams",c.competition.maxTeams),fact("Accepted teams (shown)",accepted),
          fact("Starts",fmt(c.competition.startsAt)),fact("Ends",fmt(c.competition.endsAt)),
          fact("Published",c.competition.published?"Yes":"No")],
        groups:[{title:"Registered teams",rows:registrations.map(t=>record(t.id,t.name,"Fee "+t.fee,t.status))},
          {title:"Matches",rows:matches.map(m=>record(m.id,m.stage+" · "+(fmt(m.startsAt)??"Unscheduled"),
            (m.homeId??"TBD")+" : "+(m.awayId??"TBD")+(m.homeScore!==null?" "+m.homeScore+"–"+m.awayScore:""),m.status))}],
        warnings};
    }
    if(kind==="REFEREE"){
      const [u]=await this.db.select().from(users).where(eq(users.id,id)).limit(1);
      if(!u)return null;
      const [venuesAssigned,matches,stored,profile,members,owned,managed,paid]=await Promise.all([
        this.db.select({id:venues.id,name:venues.name,city:venues.city})
          .from(venueReferees).innerJoin(venues,eq(venueReferees.venueId,venues.id))
          .where(eq(venueReferees.userId,id)).limit(70),
        this.db.select({id:competitionMatches.id,status:competitionMatches.status,
          startsAt:competitionMatches.startsAt,competitionId:competitionMatches.competitionId})
          .from(competitionMatches).where(eq(competitionMatches.refereeUserId,id))
          .orderBy(desc(competitionMatches.createdAt)).limit(70),
        this.db.select({role:userRoles.role}).from(userRoles).where(eq(userRoles.userId,id)),
        this.db.select({userId:playerProfiles.userId}).from(playerProfiles).where(eq(playerProfiles.userId,id)).limit(1),
        this.db.select({userId:teamMemberships.userId}).from(teamMemberships)
          .where(and(eq(teamMemberships.userId,id),eq(teamMemberships.status,"ACTIVE"))).limit(1),
        this.db.select({id:venues.id}).from(venues).where(eq(venues.ownerUserId,id)).limit(1),
        this.db.select({id:teams.id}).from(teams).where(eq(teams.managerUserId,id)).limit(1),
        this.db.select({status:roleSubscriptions.status}).from(roleSubscriptions).where(eq(roleSubscriptions.userId,id)).limit(1),
      ]);
      if(!venuesAssigned.length&&!stored.some(r=>r.role==="REFEREE"))return null;
      const conflict=profile.length||members.length||owned.length||managed.length||paid.length||
        stored.some(r=>r.role!=="REFEREE");
      const warnings=[
        ...(conflict?["Referee violates Normal User-only referee eligibility. Review assignments with venue owner."]:[]),
        ...(!venuesAssigned.length?["Referee grant exists without a venue assignment."]:[]),
        ...(u.status!=="ACTIVE"?["Referee account is not active."]:[]),
      ];
      return {item:{id,kind,title:u.displayName,subtitle:u.username?"@"+u.username:"Referee",
        status:u.status,secondaryStatus:null,ownerName:u.displayName,venueName:null,
        location:u.city,startsAt:null,createdAt:u.createdAt.toISOString(),warningCount:warnings.length},
        facts:[fact("User ID",id),fact("Phone",u.phoneE164),fact("Assigned venues",venuesAssigned.length),
          fact("Assigned matches (shown)",matches.length),fact("Explicit roles",stored.map(x=>x.role).join(", ")||"none")],
        groups:[{title:"Venue assignments",rows:venuesAssigned.map(v=>record(v.id,v.name,v.city))},
          {title:"Assigned matches",rows:matches.map(m=>record(m.id,m.competitionId,fmt(m.startsAt)??"Unscheduled",m.status))}],
        warnings};
    }
    const [b]=await this.db.select({booking:bookings,venue:venues.name,city:venues.city})
      .from(bookings).innerJoin(venues,eq(venues.id,bookings.venueId))
      .where(eq(bookings.id,id)).limit(1);
    if(!b)return null;
    const conflicts=await this.db.select({id:bookings.id,status:bookings.status,
      startsAt:bookings.startsAt,endsAt:bookings.endsAt}).from(bookings)
      .where(and(eq(bookings.areaId,b.booking.areaId),ne(bookings.id,id),
        eq(bookings.status,"CONFIRMED"),lt(bookings.startsAt,b.booking.endsAt),
        gt(bookings.endsAt,b.booking.startsAt))).limit(40);
    const warnings=[
      ...(b.booking.status==="CONFIRMED"&&conflicts.length?["Confirmed booking overlaps another confirmed booking on the same court."]:[]),
    ];
    return {item:{id,kind,title:b.booking.customerName||"Reservation "+id.slice(0,8),
      subtitle:"AFN "+b.booking.priceAfn+" · "+b.booking.source,status:b.booking.status,
      secondaryStatus:b.booking.source,ownerName:null,venueName:b.venue,location:b.city,
      startsAt:b.booking.startsAt.toISOString(),createdAt:b.booking.createdAt.toISOString(),
      warningCount:warnings.length},
      facts:[fact("Venue",b.venue),fact("Venue ID",b.booking.venueId),
        fact("Created by",b.booking.createdByUserId),fact("Player user ID",b.booking.playerUserId),
        fact("Customer name",b.booking.customerName),fact("Customer phone",b.booking.customerPhone),
        fact("Starts",fmt(b.booking.startsAt)),fact("Ends",fmt(b.booking.endsAt)),
        fact("Booked on",fmt(b.booking.createdAt)),fact("Price AFN",b.booking.priceAfn),
        fact("Source",b.booking.source),fact("Status",b.booking.status),
        fact("Cancellation",b.booking.cancellationReason)],
      groups:[{title:"Other overlapping confirmed reservations",rows:conflicts.map(c=>
        record(c.id,c.startsAt.toISOString(),c.endsAt.toISOString(),c.status))}],warnings};
  }

  async duplicates(){
    // Normalize all three address fields, not just names; no destructive auto-merge.
    const norm=(field:typeof venues.name|typeof venues.city|typeof venues.address)=>
      sql<string>`lower(regexp_replace(btrim(${field}), '\\s+', ' ', 'g'))`;
    const key=sql<string>`${norm(venues.name)} || '|' || ${norm(venues.city)} || '|' || ${norm(venues.address)}`;
    const groups=await this.db.select({key,count:sql<number>`count(*)::int`})
      .from(venues).groupBy(key).having(sql`count(*) > 1`).limit(40);
    const results=[];
    for(const group of groups){
      const ids=await this.db.select({id:venues.id}).from(venues)
        .where(sql`${key}=${group.key}`).limit(15);
      const items=[];
      for(const row of ids){
        const detail=await this.listDetailSeed("VENUE",row.id);
        if(detail)items.push(detail.item);
      }
      if(items.length>1)results.push({key:group.key,count:group.count,items});
    }
    return results;
  }
  async cases(f:{state?:CaseState;targetType?:CaseType;page:number;pageSize:number}){
    const where=and(f.state?eq(adminCases.state,f.state):undefined,
      f.targetType?eq(adminCases.targetType,f.targetType):undefined);
    const [rows,total]=await Promise.all([
      this.db.select().from(adminCases).where(where).orderBy(desc(adminCases.updatedAt),asc(adminCases.id))
        .limit(f.pageSize).offset((f.page-1)*f.pageSize),
      this.db.select({count:sql<number>`count(*)::int`}).from(adminCases).where(where),
    ]);
    return {items:rows.map(caseDto),total:total[0]?.count??0,page:f.page,pageSize:f.pageSize,
      hasMore:f.page*f.pageSize<(total[0]?.count??0)};
  }
  async targetCases(type:CaseType,id:string){
    return (await this.db.select().from(adminCases)
      .where(and(eq(adminCases.targetType,type),eq(adminCases.targetId,id)))
      .orderBy(desc(adminCases.openedAt)).limit(20)).map(caseDto);
  }
  async createCase(actor:string,targetType:CaseType,targetId:string,reason:string,note:string,now:Date){
    // Verify target exists; never accept arbitrary cross-entity or orphan cases.
    if(!await this.listDetailSeed(targetType,targetId))
      throw errors.badRequest("TARGET_NOT_FOUND","Target not found.");
    try{
      return await this.db.transaction(async tx=>{
        const [row]=await tx.insert(adminCases).values({
          openedByUserId:actor,targetType,targetId,reason,note,openedAt:now,updatedAt:now,
        }).returning();
        if(!row)throw errors.badRequest("CASE_CREATE_FAILED","Could not create case.");
        await tx.insert(auditLogs).values({actorUserId:actor,action:"ADMIN_CASE_OPENED",
          targetType,targetId,metadata:{caseId:row.id,reason,note},createdAt:now});
        return caseDto(row);
      });
    }catch(e){
      if(isUnique(e))throw errors.conflict("CASE_ALREADY_OPEN","A case is already open for this target.");
      throw e;
    }
  }
  async updateCase(actor:string,id:string,state:CaseState,reason:string,note:string,now:Date){
    return this.db.transaction(async tx=>{
      const [prior]=await tx.select().from(adminCases).where(eq(adminCases.id,id)).for("update").limit(1);
      if(!prior)throw errors.badRequest("CASE_NOT_FOUND","Case not found.");
      if(prior.state==="RESOLVED")throw errors.conflict("CASE_CLOSED","Resolved cases cannot be rewritten; open a new case.");
      if(state===prior.state&&note===prior.note)throw errors.badRequest("NO_CASE_CHANGE","No change to record.");
      const [updated]=await tx.update(adminCases).set({state,note,reason,updatedAt:now,
        closedAt:state==="RESOLVED"?now:null}).where(eq(adminCases.id,id)).returning();
      if(!updated)throw errors.badRequest("CASE_NOT_FOUND","Case not found.");
      await tx.insert(auditLogs).values({actorUserId:actor,action:"ADMIN_CASE_UPDATED",
        targetType:prior.targetType,targetId:prior.targetId,
        metadata:{caseId:id,previousState:prior.state,nextState:state,reason,note},createdAt:now});
      return caseDto(updated);
    });
  }
}
