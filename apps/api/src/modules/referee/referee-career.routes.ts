import {randomBytes} from "node:crypto";
import {Router,type NextFunction,type Request,type Response} from "express";
import {rateLimit} from "express-rate-limit";
import {and,eq,inArray} from "drizzle-orm";
import {z} from "zod";
import type {Database} from "@leaguekick/database";
import {competitionMatches,competitions,refereeMatchReports,refereeMatchResponses,teams,users,venues}
  from "@leaguekick/database";
import {errors} from "../../lib/errors.js";
import {requireAuth} from "../../middleware/auth.js";
import type {TokenService} from "../auth/token.service.js";
import {createRefereeReportPdf} from "./referee-report-pdf.js";
import {refereeReportMetrics} from "./referee-career-metrics.js";
import {careerCalendarParts,careerCalendarMonths,supportedCareerCalendar,
  type RefereeCareerCalendar} from "./referee-career-calendar.js";

const id=z.string().uuid();
const windowSchema=z.enum(["7d","30d","90d","year","all"]).default("all");
const calendarSchema=z.enum(["gregory","persian"]).default("gregory");
export type CareerWindow=z.infer<typeof windowSchema>;
type Event={kind:string;side:string|null;playerUserId:string|null;elapsedSeconds:number;period:number;details:string};
export type CareerRecord={
 matchId:string;competitionId:string;competitionName:string;venueId:string;venueName:string;
 homeName:string;awayName:string;startsAt:Date|null;finishedAt:Date|null;
 submittedAt:Date|null;reviewedAt:Date|null;homeScore:number|null;awayScore:number|null;
 status:string;matchStatus:string;events:Event[];
};
function filterStart(period:CareerWindow,now:Date){
 const days:Record<string,number>={"7d":7,"30d":30,"90d":90};
 return days[period]?now.getTime()-days[period]!*86400000:null;
}
/** Verified results and administrative report timeliness use separate denominators.
 * Approved match activity is the only source of official player/match statistics.
 * Report health includes every completed referee report, including drafts/returns.
 */
export function careerSummary(rows:CareerRecord[],period:CareerWindow,now:Date,
  requestedCalendar:RefereeCareerCalendar="gregory",
){
 const calendar=supportedCareerCalendar(requestedCalendar);
 const start=filterStart(period,now),year=careerCalendarParts(now,calendar).year;
 const withinPeriod=(finishedAt:Date|null)=>!!finishedAt&&(
   period==="all"||
   period==="year"&&careerCalendarParts(finishedAt,calendar).year===year||
   start!==null&&finishedAt.getTime()>=start&&finishedAt.getTime()<=now.getTime());
 const finalized=rows.filter(r=>withinPeriod(r.finishedAt));
 const verified=finalized.filter(r=>r.status==="APPROVED"&&
   ["COMPLETED","CORRECTED"].includes(r.matchStatus));
 const metrics=refereeReportMetrics(finalized);
 const total=verified.length,byMonth=new Map<string,number>();
 const byCompetition=new Map<string,{id:string;name:string;matches:number}>();
 const byVenue=new Map<string,{id:string;name:string;matches:number}>();
 const eventTypes=["GOAL","YELLOW_CARD","RED_CARD","FOUL","TIMEOUT","INCIDENT"] as const;
 const events:Record<(typeof eventTypes)[number],number>={
   GOAL:0,YELLOW_CARD:0,RED_CARD:0,FOUL:0,TIMEOUT:0,INCIDENT:0};
 for(const row of verified){
   for(const e of row.events)if(eventTypes.includes(e.kind as (typeof eventTypes)[number]))
     events[e.kind as (typeof eventTypes)[number]]++;
   const item=byCompetition.get(row.competitionId)??{id:row.competitionId,name:row.competitionName,matches:0};
   item.matches++;byCompetition.set(row.competitionId,item);
   const venue=byVenue.get(row.venueId)??{id:row.venueId,name:row.venueName,matches:0};
   venue.matches++;byVenue.set(row.venueId,venue);
   const key=careerCalendarParts(row.finishedAt!,calendar).month;
   byMonth.set(key,(byMonth.get(key)??0)+1);
 }
 const monthly=careerCalendarMonths(now,calendar).map(key=>({
   month:key,matches:byMonth.get(key)??0,
 }));
 const byCount=(a:{matches:number;name:string},b:{matches:number;name:string})=>
   b.matches-a.matches||a.name.localeCompare(b.name);
 return {period,calendar,total,...metrics,competitionsCount:byCompetition.size,
   events,monthly,competitions:[...byCompetition.values()].sort(byCount),
   venues:[...byVenue.values()].sort(byCount),
   history:verified.slice().sort((a,b)=>
     (b.finishedAt?.getTime()??0)-(a.finishedAt?.getTime()??0)||
     a.matchId.localeCompare(b.matchId))
     .map(r=>({matchId:r.matchId,competitionId:r.competitionId,competitionName:r.competitionName,
       venueId:r.venueId,venueName:r.venueName,
       homeName:r.homeName,awayName:r.awayName,
       finishedAt:r.finishedAt?.toISOString()??null,
       homeScore:r.homeScore,awayScore:r.awayScore}))};
}
type ReportPdfData={matchId:string;competitionName:string;venueName:string;refereeName:string;
 homeName:string;awayName:string;startedAt:Date|null;finishedAt:Date|null;reviewedAt:Date|null;
 score:{homeScore:number;awayScore:number};events:Event[];summary:string};
const TTL=90000;
export class RefereeCareerService{
 private tickets=new Map<string,{expires:number;report:ReportPdfData}>();
 constructor(private db:Database,private now:()=>Date=()=>new Date()){}
 async career(userId:string,period:CareerWindow,calendar:RefereeCareerCalendar="gregory"){
   const [person]=await this.db.select({status:users.status}).from(users).where(eq(users.id,userId)).limit(1);
   if(person?.status!=="ACTIVE")throw errors.forbidden("REFEREE_ACCOUNT_INACTIVE","Your account is unavailable.");
   const rows=await this.db.select({report:refereeMatchReports,match:competitionMatches,
     competitionName:competitions.name,competitionVenueId:competitions.venueId,venueName:venues.name})
     .from(refereeMatchReports)
     .innerJoin(competitionMatches,eq(competitionMatches.id,refereeMatchReports.matchId))
     .innerJoin(competitions,eq(competitions.id,competitionMatches.competitionId))
     .innerJoin(venues,eq(venues.id,competitions.venueId))
     .where(eq(refereeMatchReports.refereeUserId,userId));
   const teamIds=[...new Set(rows.flatMap(x=>[x.match.homeTeamId,x.match.awayTeamId])
     .filter((v):v is string=>!!v))];
   const teamNames=teamIds.length?await this.db.select({id:teams.id,name:teams.name})
     .from(teams).where(inArray(teams.id,teamIds)):[];
   const names=new Map(teamNames.map(x=>[x.id,x.name]));
   return careerSummary(rows.map(({report,match,competitionName,competitionVenueId,venueName})=>({
     matchId:match.id,competitionId:match.competitionId,competitionName,
     venueId:match.venueId??competitionVenueId,venueName,
     homeName:names.get(match.homeTeamId??"")??"Home",
     awayName:names.get(match.awayTeamId??"")??"Away",
     startsAt:match.startsAt,finishedAt:report.finishedAt,submittedAt:report.submittedAt,
     reviewedAt:report.reviewedAt,homeScore:match.homeScore,awayScore:match.awayScore,
     events:report.events,status:report.status,matchStatus:match.status,
   })),period,this.now(),calendar);
 }
 async newTicket(userId:string,matchId:string,owner:boolean){
   const [row]=await this.db.select({report:refereeMatchReports,match:competitionMatches,
     ownerUserId:venues.ownerUserId,competitionName:competitions.name,venueName:venues.name,
     refereeName:users.displayName})
     .from(refereeMatchReports)
     .innerJoin(competitionMatches,eq(competitionMatches.id,refereeMatchReports.matchId))
     .innerJoin(competitions,eq(competitions.id,competitionMatches.competitionId))
     .innerJoin(venues,eq(venues.id,competitions.venueId))
     .innerJoin(users,eq(users.id,refereeMatchReports.refereeUserId))
     .where(eq(refereeMatchReports.matchId,matchId)).limit(1);
   if(!row||(owner?row.ownerUserId!==userId:row.report.refereeUserId!==userId))
     throw errors.forbidden("REFEREE_PDF_FORBIDDEN","You cannot access this referee report.");
   if(row.report.status!=="APPROVED"||!["COMPLETED","CORRECTED"].includes(row.match.status))
     throw errors.conflict("REFEREE_PDF_NOT_APPROVED","The organizer must approve the report first.");
   const ids=[row.match.homeTeamId,row.match.awayTeamId].filter((x):x is string=>!!x);
   const teamRows=ids.length?await this.db.select({id:teams.id,name:teams.name}).from(teams)
     .where(inArray(teams.id,ids)):[];
   const names=new Map(teamRows.map(x=>[x.id,x.name]));
   const record:ReportPdfData={
     matchId,competitionName:row.competitionName,venueName:row.venueName,refereeName:row.refereeName,
     homeName:names.get(row.match.homeTeamId??"")??"Home",
     awayName:names.get(row.match.awayTeamId??"")??"Away",
     startedAt:row.report.startedAt,finishedAt:row.report.finishedAt,
     reviewedAt:row.report.reviewedAt,
     score:{homeScore:row.match.homeScore??0,awayScore:row.match.awayScore??0},
     events:row.report.events,summary:row.report.summary,
   };
   const now=this.now().getTime();
   for(const [key,value] of this.tickets)if(value.expires<=now)this.tickets.delete(key);
   if(this.tickets.size>=1500)throw errors.conflict("PDF_EXPORT_LIMIT","Too many PDF export requests.");
   const token=randomBytes(32).toString("hex");
   this.tickets.set(token,{report:record,expires:now+TTL});
   return {token,expiresAt:new Date(now+TTL).toISOString()};
 }
 download(token:string){
   const t=this.tickets.get(token);
   this.tickets.delete(token);
   if(!t||t.expires<=this.now().getTime())throw errors.forbidden("PDF_LINK_EXPIRED","Secure PDF link expired.");
   return createRefereeReportPdf(t.report);
 }
}
export function createRefereeCareerRouter(service:RefereeCareerService,tokens:TokenService){
 const router=Router(),auth=requireAuth(tokens);
 const downloadLimiter=rateLimit({windowMs:60000,limit:8,
   standardHeaders:"draft-8",legacyHeaders:false});
 const limit=(fn:(userId:string,req:Request)=>Promise<unknown>)=>
   async(req:Request,res:Response,next:NextFunction)=>{try{res.json(await fn(req.auth!.userId,req));}catch(e){next(e);}};
 router.get("/referee/career",auth,limit((uid,req)=>service.career(uid,
   windowSchema.parse(req.query.period),calendarSchema.parse(req.query.calendar))));
 router.post("/referee/matches/:matchId/pdf-ticket",auth,downloadLimiter,limit((uid,req)=>
   service.newTicket(uid,id.parse(req.params.matchId),false)));
 router.post("/owner/referee-reports/:matchId/pdf-ticket",auth,downloadLimiter,limit((uid,req)=>
   service.newTicket(uid,id.parse(req.params.matchId),true)));
 router.get("/referee/reports/download/:ticket",(req,res,next)=>{
   try{
     const token=z.string().regex(/^[a-f0-9]{64}$/).parse(req.params.ticket);
     const pdf=service.download(token);
     res.setHeader("Content-Type","application/pdf");
     res.setHeader("Content-Disposition",'attachment; filename="futsal-referee-report.pdf"');
     res.setHeader("Cache-Control","no-store");
     res.setHeader("X-Content-Type-Options","nosniff");
     res.send(pdf);
   }catch(e){next(e);}
 });
 return router;
}
