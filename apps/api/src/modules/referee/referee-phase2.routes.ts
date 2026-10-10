import {randomUUID} from "node:crypto";
import {Router,type Request,type Response,type NextFunction} from "express";
import {rateLimit} from "express-rate-limit";
import {z} from "zod";
import {and,eq,inArray,ne,sql} from "drizzle-orm";
import type {Database} from "@leaguekick/database";
import {auditLogs,competitionMatches,competitions,refereeMatchReports,refereeMatchResponses,
  teamMemberships,teams,users,venueReferees,venues} from "@leaguekick/database";
import {errors} from "../../lib/errors.js";
import {requireAuth} from "../../middleware/auth.js";
import type {TokenService} from "../auth/token.service.js";
import type {CompetitionService} from "../competition/competition.service.js";
import type {NotificationService} from "../notifications/notification.service.js";

const id=z.string().uuid();
export const refereeChecksSchema=z.object({
  homePresent:z.boolean(),awayPresent:z.boolean(),rosterChecked:z.boolean(),venueReady:z.boolean(),
}).strict();
export const refereeEventSchema=z.object({
  id:z.string().uuid(),
  kind:z.enum(["GOAL","YELLOW_CARD","RED_CARD","FOUL","TIMEOUT","SUBSTITUTION","INCIDENT"]),
  side:z.enum(["HOME","AWAY"]).nullable(),
  playerUserId:id.nullable(),
  period:z.number().int().min(1).max(2),
  elapsedSeconds:z.number().int().min(0).max(10800).optional(),
  details:z.string().trim().max(400).default(""),
}).strict();
const updateSchema=z.object({
  checks:refereeChecksSchema.optional(),summary:z.string().trim().max(2000).optional(),
  revision:z.number().int().min(0),
}).strict();
const eventRemoveSchema=z.object({reason:z.string().trim().min(3).max(400)}).strict();
const clockActionSchema=z.object({
  action:z.enum(["START","PAUSE","RESUME","NEXT_PERIOD","FINISH"]),
  revision:z.number().int().min(0),
}).strict();
const submitSchema=z.object({revision:z.number().int().min(0)}).strict();
const reviewSchema=z.object({
  action:z.enum(["APPROVE","RETURN"]),
  feedback:z.string().trim().max(800).default(""),
  confirmImpact:z.boolean().default(false),
}).strict();

export type RefereeEvent=z.infer<typeof refereeEventSchema> & {elapsedSeconds:number};
type Clock={elapsedSeconds:number;period:number;runningSince:string|null};
type Match=typeof competitionMatches.$inferSelect;
const emptyChecks={homePresent:false,awayPresent:false,rosterChecked:false,venueReady:false};
const emptyClock:Clock={elapsedSeconds:0,period:1,runningSince:null};
export function effectiveSeconds(clock:Clock,now:Date){
  return Math.max(0,clock.elapsedSeconds+
    (clock.runningSince?Math.max(0,Math.floor((now.getTime()-Date.parse(clock.runningSince))/1000)):0));
}
export function reportScore(events:ReadonlyArray<RefereeEvent>){
  return {homeScore:events.filter(e=>e.kind==="GOAL"&&e.side==="HOME").length,
    awayScore:events.filter(e=>e.kind==="GOAL"&&e.side==="AWAY").length};
}
export function reportPlayerStats(events:ReadonlyArray<RefereeEvent>,match:Pick<Match,"homeTeamId"|"awayTeamId">){
  const byPlayer=new Map<string,{playerUserId:string;teamId:string;appeared:boolean;goals:number;assists:number;
    yellowCards:number;redCards:number;cleanSheet:boolean;playerOfMatch:boolean}>();
  for(const e of events){
    if(!e.playerUserId||!e.side||!["GOAL","YELLOW_CARD","RED_CARD"].includes(e.kind))continue;
    const teamId=e.side==="HOME"?match.homeTeamId:match.awayTeamId;
    if(!teamId)continue;
    const key=teamId+":"+e.playerUserId;
    const row=byPlayer.get(key)??{playerUserId:e.playerUserId,teamId,appeared:true,goals:0,
      assists:0,yellowCards:0,redCards:0,cleanSheet:false,playerOfMatch:false};
    if(e.kind==="GOAL")row.goals++;
    if(e.kind==="YELLOW_CARD")row.yellowCards++;
    if(e.kind==="RED_CARD")row.redCards++;
    byPlayer.set(key,row);
  }
  return [...byPlayer.values()];
}
function canEdit(status:string){return status==="DRAFT"||status==="CHANGES_REQUESTED";}
function checksComplete(checks:typeof emptyChecks){return Object.values(checks).every(Boolean);}

export class RefereePhase2Service{
  constructor(private readonly db:Database,private readonly competitionsService:CompetitionService,
    private readonly notifications?:NotificationService,private readonly now:()=>Date=()=>new Date()){}
  private async notify(userId:string,competitionId:string,title:string,body:string,dedupeKey:string){
    try{await this.notifications?.competitionUpdate({competitionId,title,body,userIds:[userId],dedupeKey});}
    catch(error){console.error(JSON.stringify({event:"referee_notification_failed",
      kind:title,errorType:error instanceof Error?error.name:typeof error}));}
  }
  private async access(userId:string,matchId:string,write:boolean){
    const [record]=await this.db.select({match:competitionMatches,competition:competitions,
      ownerUserId:venues.ownerUserId,userStatus:users.status})
      .from(competitionMatches).innerJoin(competitions,eq(competitions.id,competitionMatches.competitionId))
      .innerJoin(venues,eq(venues.id,competitions.venueId))
      .innerJoin(users,eq(users.id,competitionMatches.refereeUserId))
      .where(and(eq(competitionMatches.id,matchId),eq(competitionMatches.refereeUserId,userId))).limit(1);
    if(!record||record.userStatus!=="ACTIVE")throw errors.forbidden("REFEREE_MATCH_REQUIRED","You do not officiate this match.");
    const [response,auth]=await Promise.all([
      this.db.select({status:refereeMatchResponses.status}).from(refereeMatchResponses)
        .where(and(eq(refereeMatchResponses.matchId,matchId),eq(refereeMatchResponses.refereeUserId,userId))).limit(1),
      this.db.select({id:venueReferees.venueId}).from(venueReferees)
        .where(and(eq(venueReferees.userId,userId),eq(venueReferees.venueId,record.competition.venueId))).limit(1),
    ]);
    if(response[0]?.status!=="ACCEPTED")throw errors.forbidden("REFEREE_NOT_CONFIRMED","Accept the assignment first.");
    if(!auth.length){
      if(write)throw errors.forbidden("REFEREE_VENUE_REQUIRED","Venue authorization was removed.");
      const [oldReport]=await this.db.select({status:refereeMatchReports.status})
        .from(refereeMatchReports).where(and(eq(refereeMatchReports.matchId,matchId),
          eq(refereeMatchReports.refereeUserId,userId))).limit(1);
      if(!oldReport||!["SUBMITTED","CHANGES_REQUESTED","APPROVING","APPROVED"].includes(oldReport.status))
        throw errors.forbidden("REFEREE_VENUE_REQUIRED","Venue authorization was removed.");
    }
    if(write&&!["SCHEDULED","IN_PROGRESS"].includes(record.match.status))
      throw errors.conflict("MATCH_ALREADY_OFFICIAL","Official result is finalized or match is unavailable.");
    return {...record,authorized:auth.length>0};
  }
  private async organizer(userId:string,competitionId:string){
    const [record]=await this.db.select({competitionId:competitions.id})
      .from(competitions).innerJoin(venues,eq(venues.id,competitions.venueId))
      .where(and(eq(competitions.id,competitionId),eq(venues.ownerUserId,userId))).limit(1);
    if(!record)throw errors.forbidden("COMPETITION_OWNER_REQUIRED","You do not own this competition.");
  }
  private async initialized(matchId:string,userId:string){
    await this.db.insert(refereeMatchReports).values({matchId,refereeUserId:userId})
      .onConflictDoNothing({target:refereeMatchReports.matchId});
    const [row]=await this.db.select().from(refereeMatchReports).where(eq(refereeMatchReports.matchId,matchId)).limit(1);
    if(!row||row.refereeUserId!==userId)throw errors.forbidden("REFEREE_REPORT_OWNERSHIP","This report belongs to another referee.");
    return row;
  }
  async get(userId:string,matchId:string){
    const {match,competition,authorized}=await this.access(userId,matchId,false);
    const [rows,roster]=await Promise.all([
      this.db.select().from(refereeMatchReports).where(eq(refereeMatchReports.matchId,matchId)).limit(1),
      authorized?this.db.select({teamId:teamMemberships.teamId,userId:teamMemberships.userId,
        name:users.displayName,shirtNumber:teamMemberships.shirtNumber})
        .from(teamMemberships).innerJoin(users,eq(users.id,teamMemberships.userId))
        .where(and(inArray(teamMemberships.teamId,[match.homeTeamId,match.awayTeamId].filter((v):v is string=>!!v)),
          eq(teamMemberships.status,"ACTIVE"))):Promise.resolve([]),
    ]);
    const row=rows[0];
    // No report is created merely by viewing a match.
    return {report:row&&row.refereeUserId===userId?this.format(row):null,
      match:{id:match.id,competitionId:match.competitionId,homeTeamId:match.homeTeamId,
        awayTeamId:match.awayTeamId,matchStatus:match.status,stage:match.stage,
        startsAt:match.startsAt?.toISOString()??null,durationMinutes:competition.matchDurationMinutes},
      roster};
  }
  private format(row:typeof refereeMatchReports.$inferSelect){
    const clock=row.clock??emptyClock;
    const events=row.events as RefereeEvent[];
    return {matchId:row.matchId,status:row.status,events,checks:row.checks,clock,
      currentSeconds:effectiveSeconds(clock,this.now()),score:reportScore(events),
      startedAt:row.startedAt?.toISOString()??null,finishedAt:row.finishedAt?.toISOString()??null,
      summary:row.summary,revision:row.revision,submittedAt:row.submittedAt?.toISOString()??null,
      reviewedAt:row.reviewedAt?.toISOString()??null,feedback:row.feedback};
  }
  // Locking the match serializes event, checklist, clock and submission writes.
  private async mutate(userId:string,matchId:string,revision:number,
    fn:(row:typeof refereeMatchReports.$inferSelect,match:Match)=>
      Partial<typeof refereeMatchReports.$inferInsert> | Promise<Partial<typeof refereeMatchReports.$inferInsert>>){
    const {match}=await this.access(userId,matchId,true);
    const result=await this.db.transaction(async tx=>{
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${matchId}))`);
      const row=await this.initialized(matchId,userId);
      if(!canEdit(row.status))throw errors.conflict("REFEREE_REPORT_LOCKED","This report is under organizer review.");
      if(row.revision!==revision)throw errors.conflict("REFEREE_REPORT_STALE","Report changed. Refresh before editing.");
      const patch=await fn(row,match);
      const [updated]=await tx.update(refereeMatchReports).set({...patch,revision:row.revision+1,
        updatedAt:this.now()}).where(and(eq(refereeMatchReports.matchId,matchId),
          eq(refereeMatchReports.refereeUserId,userId),eq(refereeMatchReports.revision,revision)))
        .returning();
      if(!updated)throw errors.conflict("REFEREE_REPORT_STALE","Report changed. Refresh before editing.");
      return updated;
    });
    return {report:this.format(result)};
  }
  async update(userId:string,matchId:string,input:z.infer<typeof updateSchema>){
    return this.mutate(userId,matchId,input.revision,row=>{
      if(input.checks&&row.startedAt)throw errors.conflict("CHECKS_LOCKED","Pre-match checks cannot be changed after kickoff.");
      return {...(input.checks?{checks:input.checks}:{}),
        ...(input.summary!==undefined?{summary:input.summary}:{})};
    });
  }
  async clockAction(userId:string,matchId:string,input:z.infer<typeof clockActionSchema>){
    return this.mutate(userId,matchId,input.revision,(row,match)=>{
      const old=row.clock??emptyClock,now=this.now(),clock={...old};
      const seconds=effectiveSeconds(clock,now);
      if(input.action==="START"){
        if(row.startedAt)throw errors.conflict("MATCH_STARTED","Match already started.");
        if(!checksComplete(row.checks))throw errors.conflict("CHECKLIST_INCOMPLETE","Complete pre-match checks first.");
        if(match.startsAt&&now.getTime()<match.startsAt.getTime()-30*60_000)
          throw errors.conflict("KICKOFF_TOO_EARLY","Match cannot start more than 30 minutes early.");
        return {startedAt:now,clock:{elapsedSeconds:0,period:1,runningSince:now.toISOString()}};
      }
      if(!row.startedAt||row.finishedAt)throw errors.conflict("MATCH_CLOCK_UNAVAILABLE","Match is not live.");
      if(input.action==="PAUSE"){
        if(!clock.runningSince)throw errors.conflict("CLOCK_ALREADY_PAUSED","Clock is already paused.");
        return {clock:{...clock,elapsedSeconds:seconds,runningSince:null}};
      }
      if(input.action==="RESUME"){
        if(clock.runningSince)throw errors.conflict("CLOCK_ALREADY_RUNNING","Clock is already running.");
        return {clock:{...clock,runningSince:now.toISOString()}};
      }
      if(input.action==="NEXT_PERIOD"){
        if(clock.period!==1||clock.runningSince)
          throw errors.conflict("PERIOD_UNAVAILABLE","Pause the first period before starting the second.");
        return {clock:{period:2,elapsedSeconds:0,runningSince:null}};
      }
      return {clock:{...clock,elapsedSeconds:seconds,runningSince:null},finishedAt:now};
    });
  }
  async addEvent(userId:string,matchId:string,input:z.infer<typeof refereeEventSchema>){
    return this.mutate(userId,matchId,await this.revision(matchId),async(row,match)=>{
      if(!row.startedAt)throw errors.conflict("MATCH_NOT_STARTED","Kick off before recording events.");
      if(row.finishedAt&&row.status!=="CHANGES_REQUESTED")
        throw errors.conflict("MATCH_FINISHED","The match is finished.");
      if(row.events.some(event=>event.id===input.id))return {};
      if(row.events.length>=300)throw errors.conflict("EVENT_LIMIT","Maximum 300 recorded events.");
      if(input.kind!=="INCIDENT"&&!input.side)throw errors.badRequest("EVENT_TEAM_REQUIRED","Choose the team for this event.");
      if(input.side&&!(input.side==="HOME"?match.homeTeamId:match.awayTeamId))
        throw errors.conflict("MATCH_TEAM_MISSING","Team is unavailable.");
      if(input.playerUserId){
        if(!input.side)throw errors.badRequest("EVENT_TEAM_REQUIRED","Choose the player's team.");
        const teamId=input.side==="HOME"?match.homeTeamId:match.awayTeamId;
        const [member]=await this.db.select({id:teamMemberships.userId}).from(teamMemberships)
          .where(and(eq(teamMemberships.userId,input.playerUserId),
            eq(teamMemberships.teamId,teamId!),eq(teamMemberships.status,"ACTIVE"))).limit(1);
        if(!member)throw errors.forbidden("EVENT_PLAYER_NOT_ON_TEAM","Player is not on this team's roster.");
      }
      const clock=row.clock??emptyClock;
      const second=row.finishedAt?input.elapsedSeconds??effectiveSeconds(clock,this.now()):effectiveSeconds(clock,this.now());
      const event={...input,elapsedSeconds:second,details:input.details??""};
      const proposed=[...(row.events as RefereeEvent[]),event];
      const score=reportScore(proposed);
      if(score.homeScore>99||score.awayScore>99)throw errors.conflict("SCORE_LIMIT","A score cannot exceed 99.");
      return {events:proposed};
    });
  }
  private async revision(matchId:string){
    const [row]=await this.db.select({revision:refereeMatchReports.revision})
      .from(refereeMatchReports).where(eq(refereeMatchReports.matchId,matchId)).limit(1);
    return row?.revision??0;
  }
  async deleteEvent(userId:string,matchId:string,eventId:string,reason:string,revision:number){
    const result=await this.mutate(userId,matchId,revision,row=>{
      if(row.finishedAt&&row.status!=="CHANGES_REQUESTED")
        throw errors.conflict("MATCH_FINISHED","The match is finished.");
      if(!row.events.some(x=>x.id===eventId))
        throw errors.badRequest("EVENT_NOT_FOUND","This event does not exist.");
      return {events:row.events.filter(x=>x.id!==eventId)};
    });
    await this.db.insert(auditLogs).values({actorUserId:userId,action:"REFEREE_EVENT_RETRACTED",
      targetType:"competition_match",targetId:matchId,
      metadata:{eventId,reason},createdAt:this.now()});
    return result;
  }
  async submit(userId:string,matchId:string,input:z.infer<typeof submitSchema>){
    const result=await this.mutate(userId,matchId,input.revision,(row,match)=>{
      if(!row.startedAt||!row.finishedAt||!checksComplete(row.checks))
        throw errors.conflict("REPORT_NOT_READY","Start and finish the match after completing the checklist.");
      const score=reportScore(row.events as RefereeEvent[]);
      if(match.stage==="KNOCKOUT"&&score.homeScore===score.awayScore)
        throw errors.conflict("KNOCKOUT_WINNER_REQUIRED","A knockout report requires a winner.");
      return {status:"SUBMITTED",submittedAt:this.now(),feedback:null};
    });
    const [match]=await this.db.select({competitionId:competitionMatches.competitionId,
      ownerId:venues.ownerUserId}).from(competitionMatches)
      .innerJoin(competitions,eq(competitions.id,competitionMatches.competitionId))
      .innerJoin(venues,eq(venues.id,competitions.venueId))
      .where(eq(competitionMatches.id,matchId)).limit(1);
    if(match)void this.notify(match.ownerId,match.competitionId,"Referee report submitted",
      "A referee submitted an official match report for your review.",
      "referee-report-submitted:"+matchId+":"+result.report.revision);
    return result;
  }
  async listReports(ownerId:string,competitionId:string){
    await this.organizer(ownerId,competitionId);
    const rows=await this.db.select({report:refereeMatchReports,
      match:competitionMatches,refereeName:users.displayName})
      .from(refereeMatchReports)
      .innerJoin(competitionMatches,eq(refereeMatchReports.matchId,competitionMatches.id))
      .innerJoin(users,eq(users.id,refereeMatchReports.refereeUserId))
      .where(and(eq(competitionMatches.competitionId,competitionId),
        inArray(refereeMatchReports.status,["SUBMITTED","CHANGES_REQUESTED","APPROVING","APPROVED"])));
    const teamIds=[...new Set(rows.flatMap(x=>[x.match.homeTeamId,x.match.awayTeamId])
      .filter((value):value is string=>!!value))];
    const teamsList=teamIds.length?await this.db.select({id:teams.id,name:teams.name})
      .from(teams).where(inArray(teams.id,teamIds)):[];
    const teamNames=new Map(teamsList.map(x=>[x.id,x.name]));
    return {reports:rows.map(({report,match,refereeName})=>({
      ...this.format(report),refereeName,refereeUserId:report.refereeUserId,
      competitionId:match.competitionId,homeTeamId:match.homeTeamId,awayTeamId:match.awayTeamId,
      homeTeamName:teamNames.get(match.homeTeamId??"")??"TBD",
      awayTeamName:teamNames.get(match.awayTeamId??"")??"TBD",
      matchStatus:match.status,
    }))};
  }
  async review(ownerId:string,matchId:string,input:z.infer<typeof reviewSchema>){
    const [row]=await this.db.select({report:refereeMatchReports,match:competitionMatches})
      .from(refereeMatchReports).innerJoin(competitionMatches,eq(refereeMatchReports.matchId,competitionMatches.id))
      .where(eq(refereeMatchReports.matchId,matchId)).limit(1);
    if(!row)throw errors.badRequest("REFEREE_REPORT_NOT_FOUND","This match has no referee report.");
    await this.organizer(ownerId,row.match.competitionId);
    if(input.action==="RETURN"){
      if(input.feedback.length<3)throw errors.badRequest("REVIEW_REASON_REQUIRED","Provide a correction reason.");
      const [changed]=await this.db.update(refereeMatchReports).set({status:"CHANGES_REQUESTED",
        feedback:input.feedback,reviewedAt:this.now(),reviewedByUserId:ownerId,
        revision:row.report.revision+1,updatedAt:this.now()})
        .where(and(eq(refereeMatchReports.matchId,matchId),eq(refereeMatchReports.status,"SUBMITTED"),
          eq(refereeMatchReports.revision,row.report.revision))).returning();
      if(!changed)throw errors.conflict("REPORT_REVIEW_CONFLICT","Refresh the report before reviewing.");
      void this.notify(changed.refereeUserId,row.match.competitionId,"Referee report correction requested",
        "The competition organizer returned your report with feedback.",
        "referee-report-returned:"+matchId+":"+changed.revision);
      return {report:this.format(changed)};
    }
    if(row.report.status!=="SUBMITTED")
      throw errors.conflict("REPORT_NOT_SUBMITTED","Only submitted reports can be approved.");
    const [locked]=await this.db.update(refereeMatchReports).set({status:"APPROVING",updatedAt:this.now()})
      .where(and(eq(refereeMatchReports.matchId,matchId),eq(refereeMatchReports.status,"SUBMITTED"),
        eq(refereeMatchReports.revision,row.report.revision))).returning();
    if(!locked)throw errors.conflict("REPORT_REVIEW_CONFLICT","This report is being reviewed.");
    try{
      const scores=reportScore(locked.events as RefereeEvent[]);
      await this.competitionsService.enterResult(ownerId,row.match.competitionId,matchId,{
        ...scores,playerStats:reportPlayerStats(locked.events as RefereeEvent[],row.match),
        confirmImpact:input.confirmImpact,
        ...(row.match.status==="COMPLETED"||row.match.status==="CORRECTED"
          ?{correctionReason:input.feedback.trim()||"Approved referee report"}:{}),
      });
      const [approved]=await this.db.update(refereeMatchReports).set({
        status:"APPROVED",feedback:input.feedback||null,reviewedAt:this.now(),reviewedByUserId:ownerId,
        revision:locked.revision+1,updatedAt:this.now(),
      }).where(and(eq(refereeMatchReports.matchId,matchId),eq(refereeMatchReports.status,"APPROVING"))).returning();
      await this.db.insert(auditLogs).values({actorUserId:ownerId,action:"REFEREE_REPORT_APPROVED",
        targetType:"competition_match",targetId:matchId,
        metadata:{competitionId:row.match.competitionId,refereeUserId:row.report.refereeUserId,
          score:reportScore(approved!.events as RefereeEvent[])},createdAt:this.now()});
      void this.notify(approved!.refereeUserId,row.match.competitionId,"Referee report approved",
        "Your match report was approved and the official result is published.",
        "referee-report-approved:"+matchId+":"+approved!.revision);
      return {report:this.format(approved!)};
    }catch(error){
      await this.db.update(refereeMatchReports).set({status:"SUBMITTED",updatedAt:this.now()})
        .where(and(eq(refereeMatchReports.matchId,matchId),eq(refereeMatchReports.status,"APPROVING")));
      throw error;
    }
  }
}

export function createRefereePhase2Router(service:RefereePhase2Service,tokens:TokenService){
  const router=Router(),auth=requireAuth(tokens);
  const limit=rateLimit({windowMs:60_000,limit:100,standardHeaders:"draft-8",legacyHeaders:false});
  const handle=(fn:(u:string,r:Request)=>Promise<unknown>)=>async(req:Request,res:Response,next:NextFunction)=>{
    try{res.json(await fn(req.auth!.userId,req));}catch(error){next(error);}
  };
  router.get("/referee/matches/:matchId/report",auth,handle((u,r)=>service.get(u,id.parse(r.params.matchId))));
  router.patch("/referee/matches/:matchId/report",auth,limit,handle((u,r)=>
    service.update(u,id.parse(r.params.matchId),updateSchema.parse(r.body))));
  router.post("/referee/matches/:matchId/clock",auth,limit,handle((u,r)=>
    service.clockAction(u,id.parse(r.params.matchId),clockActionSchema.parse(r.body))));
  router.post("/referee/matches/:matchId/events",auth,limit,handle((u,r)=>
    service.addEvent(u,id.parse(r.params.matchId),refereeEventSchema.parse(r.body))));
  router.delete("/referee/matches/:matchId/events/:eventId",auth,limit,handle((u,r)=>{
    const input=z.object({reason:z.string().trim().min(3).max(400),revision:z.number().int().min(0)}).parse(r.body);
    return service.deleteEvent(u,id.parse(r.params.matchId),id.parse(r.params.eventId),input.reason,input.revision);
  }));
  router.post("/referee/matches/:matchId/submit",auth,limit,handle((u,r)=>
    service.submit(u,id.parse(r.params.matchId),submitSchema.parse(r.body))));
  return router;
}
export function createOwnerRefereePhase2Router(service:RefereePhase2Service,tokens:TokenService){
  const router=Router(),auth=requireAuth(tokens);
  const limit=rateLimit({windowMs:60_000,limit:30,standardHeaders:"draft-8",legacyHeaders:false});
  const handle=(fn:(u:string,r:Request)=>Promise<unknown>)=>async(req:Request,res:Response,next:NextFunction)=>{
    try{res.json(await fn(req.auth!.userId,req));}catch(error){next(error);}
  };
  router.get("/referee-reports/:competitionId",auth,handle((u,r)=>service.listReports(u,id.parse(r.params.competitionId))));
  router.post("/referee-reports/:matchId/review",auth,limit,handle((u,r)=>
    service.review(u,id.parse(r.params.matchId),reviewSchema.parse(r.body))));
  return router;
}
