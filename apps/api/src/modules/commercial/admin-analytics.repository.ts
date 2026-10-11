import type {AdminAnalyticsDays,AdminAnalyticsResponse} from "@leaguekick/contracts";
import type {Database} from "@leaguekick/database";
import {
  users,venues,teams,competitions,bookings,subscriptionPayments,
  venueSubscriptions,roleSubscriptions,teamExtraSubscriptions,userRoles,
} from "@leaguekick/database";
import {and,asc,desc,eq,gte,gt,lt,lte,sql} from "drizzle-orm";

type Snapshot=Omit<AdminAnalyticsResponse,"generatedAt">;
type DailyPoint=AdminAnalyticsResponse["daily"][number];
type SeriesKey=Exclude<keyof DailyPoint,"date">;
const tz="Asia/Kabul" as const;
function num(value:unknown){const n=Number(value??0);return Number.isFinite(n)?n:0;}
function dateOnly(now:Date){
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(now);
  const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return [value.year,value.month,value.day].join("-");
}
function moveDay(day:string,offset:number){
  const at=new Date(day+"T00:00:00.000Z");
  at.setUTCDate(at.getUTCDate()+offset);
  return at.toISOString().slice(0,10);
}
function kabulMidnight(day:string){
  // Afghanistan time is UTC+04:30 all year (no daylight saving).
  return new Date(Date.parse(day+"T00:00:00.000Z")-270*60*1000);
}
function timeline(from:string,days:AdminAnalyticsDays){
  return Array.from({length:days},(_,i)=>({
    date:moveDay(from,i),newUsers:0,newVenues:0,newTeams:0,
    newCompetitions:0,confirmedBookings:0,bookingGmvAfn:0,
    recordedVenuePaymentsAfn:0,
  }));
}
const dateGroup=(field:typeof users.createdAt)=>
  sql<string>`to_char(${field} AT TIME ZONE 'Asia/Kabul','YYYY-MM-DD')`;

export class DrizzleAdminAnalyticsRepository{
  constructor(private readonly db:Database){}

  async snapshot(now:Date,days:AdminAnalyticsDays):Promise<Snapshot>{
    const today=dateOnly(now);
    const from=moveDay(today,1-days);
    const after=moveDay(today,1);
    const fromAt=kabulMidnight(from),beforeAt=kabulMidnight(after);
    const soon=new Date(now.getTime()+7*86400000);
    const userDate=dateGroup(users.createdAt);
    const venueDate=dateGroup(venues.createdAt);
    const teamDate=dateGroup(teams.createdAt);
    const competitionDate=dateGroup(competitions.createdAt);
    const bookingDate=dateGroup(bookings.startsAt);
    const paymentDate=dateGroup(subscriptionPayments.createdAt);

    // Aggregate inside PostgreSQL; never pull customer rows or payment references.
    const [
      userSummary,venueSummary,teamSummary,competitionSummary,
      activeVenuePaying,activeManagerPaying,extraSlots,
      userDaily,venueDaily,teamDaily,competitionDaily,bookingDaily,paymentDaily,
      roles,provinces,pendingRole,pendingExtras,pendingBookings,expiringPaid,
    ]=await Promise.all([
      this.db.select({
        total:sql<number>`count(*)::int`,
        active:sql<number>`count(*) filter(where ${users.status} = 'ACTIVE')::int`,
      }).from(users),
      this.db.select({
        total:sql<number>`count(*)::int`,
        active:sql<number>`count(*) filter(where ${venues.status} = 'ACTIVE')::int`,
        verified:sql<number>`count(*) filter(where ${venues.verificationStatus}='VERIFIED')::int`,
        pending:sql<number>`count(*) filter(where ${venues.verificationStatus}='PENDING')::int`,
      }).from(venues),
      this.db.select({total:sql<number>`count(*)::int`}).from(teams),
      this.db.select({total:sql<number>`count(*)::int`}).from(competitions)
        .where(sql`${competitions.status} IN ('IN_PROGRESS','REGISTRATION_OPEN','REGISTRATION_CLOSED','SCHEDULED')`),
      this.db.select({total:sql<number>`count(*)::int`}).from(venueSubscriptions)
        .where(and(eq(venueSubscriptions.status,"ACTIVE"),gt(venueSubscriptions.activeUntil,now))),
      this.db.select({total:sql<number>`count(*)::int`}).from(roleSubscriptions)
        .where(and(eq(roleSubscriptions.role,"TEAM_MANAGER"),
          eq(roleSubscriptions.status,"ACTIVE"),gt(roleSubscriptions.activeUntil,now))),
      this.db.select({total:sql<number>`count(*)::int`}).from(teamExtraSubscriptions)
        .where(and(eq(teamExtraSubscriptions.status,"ACTIVE"),gt(teamExtraSubscriptions.activeUntil,now))),
      this.db.select({day:userDate,count:sql<number>`count(*)::int`})
        .from(users).where(and(gte(users.createdAt,fromAt),lt(users.createdAt,beforeAt)))
        .groupBy(userDate),
      this.db.select({day:venueDate,count:sql<number>`count(*)::int`})
        .from(venues).where(and(gte(venues.createdAt,fromAt),lt(venues.createdAt,beforeAt)))
        .groupBy(venueDate),
      this.db.select({day:teamDate,count:sql<number>`count(*)::int`})
        .from(teams).where(and(gte(teams.createdAt,fromAt),lt(teams.createdAt,beforeAt)))
        .groupBy(teamDate),
      this.db.select({day:competitionDate,count:sql<number>`count(*)::int`})
        .from(competitions).where(and(gte(competitions.createdAt,fromAt),lt(competitions.createdAt,beforeAt)))
        .groupBy(competitionDate),
      this.db.select({
        day:bookingDate,count:sql<number>`count(*)::int`,
        online:sql<number>`count(*) filter(where ${bookings.source}='ONLINE')::int`,
        gmv:sql<number>`coalesce(sum(${bookings.priceAfn}),0)::float8`,
      }).from(bookings)
        .where(and(eq(bookings.status,"CONFIRMED"),gte(bookings.startsAt,fromAt),lt(bookings.startsAt,beforeAt)))
        .groupBy(bookingDate),
      this.db.select({
        day:paymentDate,count:sql<number>`count(*)::int`,
        amount:sql<number>`coalesce(sum(${subscriptionPayments.amountAfn}),0)::float8`,
      }).from(subscriptionPayments)
        .where(and(eq(subscriptionPayments.status,"RECORDED"),
          gte(subscriptionPayments.createdAt,fromAt),lt(subscriptionPayments.createdAt,beforeAt)))
        .groupBy(paymentDate),
      this.db.select({role:userRoles.role,count:sql<number>`count(*)::int`})
        .from(userRoles).groupBy(userRoles.role).orderBy(desc(sql`count(*)`)),
      this.db.select({province:venues.province,venues:sql<number>`count(*)::int`})
        .from(venues).groupBy(venues.province).orderBy(desc(sql`count(*)`)).limit(8),
      this.db.select({total:sql<number>`count(*)::int`}).from(roleSubscriptions)
        .where(eq(roleSubscriptions.status,"PENDING")),
      this.db.select({total:sql<number>`count(*)::int`}).from(teamExtraSubscriptions)
        .where(eq(teamExtraSubscriptions.status,"PENDING")),
      this.db.select({total:sql<number>`count(*)::int`}).from(bookings)
        .where(eq(bookings.status,"PENDING")),
      this.db.select({total:sql<number>`count(*)::int`}).from(venueSubscriptions)
        .where(and(eq(venueSubscriptions.status,"ACTIVE"),gt(venueSubscriptions.activeUntil,now),
          lte(venueSubscriptions.activeUntil,soon))),
    ]);
    const daily=timeline(from,days);
    const map=new Map(daily.map(point=>[point.date,point]));
    function apply(rows:readonly {day:string;count:number}[],key:SeriesKey){
      for(const row of rows){
        const point=map.get(row.day);
        if(point)(point[key] as number)+=num(row.count);
      }
    }
    apply(userDaily,"newUsers");apply(venueDaily,"newVenues");
    apply(teamDaily,"newTeams");apply(competitionDaily,"newCompetitions");
    apply(bookingDaily,"confirmedBookings");
    for(const row of bookingDaily){
      const point=map.get(row.day);
      if(point)point.bookingGmvAfn+=num(row.gmv);
    }
    for(const row of paymentDaily){
      const point=map.get(row.day);
      if(point)point.recordedVenuePaymentsAfn+=num(row.amount);
    }
    const sum=(key:SeriesKey)=>daily.reduce((total,row)=>total+row[key],0);
    return {
      period:{from,to:today,days,timezone:tz},
      totals:{
        users:num(userSummary[0]?.total),
        activeAccounts:num(userSummary[0]?.active),
        venues:num(venueSummary[0]?.total),
        activeVenues:num(venueSummary[0]?.active),
        verifiedVenues:num(venueSummary[0]?.verified),
        payingVenues:num(activeVenuePaying[0]?.total),
        payingTeamManagers:num(activeManagerPaying[0]?.total),
        activeExtraTeamSlots:num(extraSlots[0]?.total),
        teams:num(teamSummary[0]?.total),
        activeCompetitions:num(competitionSummary[0]?.total),
      },
      metrics:{
        newUsers:sum("newUsers"),newVenues:sum("newVenues"),
        newTeams:sum("newTeams"),newCompetitions:sum("newCompetitions"),
        confirmedBookings:sum("confirmedBookings"),
        onlineConfirmedBookings:bookingDaily.reduce((total,row)=>total+num(row.online),0),
        bookingGmvAfn:sum("bookingGmvAfn"),
        recordedVenuePaymentsAfn:sum("recordedVenuePaymentsAfn"),
        recordedVenuePaymentsCount:paymentDaily.reduce((total,row)=>total+num(row.count),0),
      },
      daily,
      roleGrants:roles.map(row=>({role:row.role,count:num(row.count)})),
      topProvinces:provinces.map(row=>({province:row.province,venues:num(row.venues)})),
      attention:{
        pendingVenueVerifications:num(venueSummary[0]?.pending),
        pendingRoleSubscriptions:num(pendingRole[0]?.total),
        pendingExtraTeamSlots:num(pendingExtras[0]?.total),
        pendingBookings:num(pendingBookings[0]?.total),
        expiringPaidVenues7d:num(expiringPaid[0]?.total),
      },
      revenueScope:"RECORDED_VENUE_PAYMENTS_ONLY",
      gmvScope:"CONFIRMED_BOOKING_VALUE_NOT_CASH",
    };
  }
}
