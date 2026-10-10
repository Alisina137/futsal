import {Router,type Request,type Response,type NextFunction} from "express";
import {rateLimit} from "express-rate-limit";
import {z} from "zod";
import {and,eq,gt,inArray,lt,or,sql} from "drizzle-orm";
import type {Database} from "@leaguekick/database";
import {competitionMatches,competitions,refereeMatchResponses,refereeProfiles,
  teamMemberships,teams,users,venueReferees,venues} from "@leaguekick/database";
import {errors} from "../../lib/errors.js";
import {requireAuth} from "../../middleware/auth.js";
import type {TokenService} from "../auth/token.service.js";

const uuid=z.string().uuid();
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const refereeProfileSchema=z.object({
  level:z.string().trim().max(60).nullable(),
  experienceYears:z.number().int().min(0).max(70),
  biography:z.string().trim().max(500).nullable(),
  weeklyAvailability:z.array(z.object({
    day:z.number().int().min(0).max(6),start:time,end:time,
  }).refine(x=>x.end>x.start,{message:"End time must be after start."})).max(21),
  exceptions:z.array(z.object({
    date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),available:z.boolean(),
  })).max(100),
}).strict();
const replySchema=z.object({
  action:z.enum(["ACCEPTED","DECLINED","WITHDRAW_REQUESTED"]),
  reason:z.string().trim().max(400).optional(),
}).strict();

export type RefereeAvailability={day:number;start:string;end:string};
export type RefereeException={date:string;available:boolean};
export function kabulDateParts(date:Date){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",
    year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const data=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return {date:`${data.year}-${data.month}-${data.day}`,
    day:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(data.weekday??""),
    clock:`${data.hour}:${data.minute}`};
}
export function availabilityAllows(start:Date,end:Date,
  slots:RefereeAvailability[],exceptions:RefereeException[]){
  if(!(end>start))return false;
  const from=kabulDateParts(start),to=kabulDateParts(end);
  if(from.date!==to.date)return false; // Overnight availability is not implicit.
  const exception=exceptions.find(e=>e.date===from.date);
  if(exception?.available===false)return false;
  if(exception?.available===true)return true;
  if(slots.length===0)return true; // Empty schedule means no weekly restriction.
  return slots.some(slot=>slot.day===from.day&&slot.start<=from.clock&&slot.end>=to.clock);
}

export class RefereeService{
  constructor(private readonly db:Database,private readonly now:()=>Date=()=>new Date()){}
  private async authorization(userId:string){
    const [person,authorized]=await Promise.all([
      this.db.select({id:users.id,name:users.displayName,status:users.status,
        city:users.city,image:users.profileImageUrl}).from(users).where(eq(users.id,userId)).limit(1),
      this.db.select({id:venues.id,name:venues.name,city:venues.city,province:venues.province,
        address:venues.address,latitude:venues.latitude,longitude:venues.longitude})
        .from(venueReferees).innerJoin(venues,eq(venueReferees.venueId,venues.id))
        .where(eq(venueReferees.userId,userId)),
    ]);
    if(person[0]?.status!=="ACTIVE")throw errors.forbidden("REFEREE_UNAVAILABLE","Account is unavailable.");
    return {person:person[0]!,venues:authorized};
  }
  private async assignments(userId:string){
    const {venues:allowed}=await this.authorization(userId);
    const records=await this.db.select({
      match:competitionMatches,competitionName:competitions.name,format:competitions.format,
      duration:competitions.matchDurationMinutes,venueName:venues.name,
      venueAddress:venues.address,latitude:venues.latitude,longitude:venues.longitude,
    }).from(competitionMatches)
      .innerJoin(competitions,eq(competitions.id,competitionMatches.competitionId))
      .innerJoin(venues,eq(venues.id,competitions.venueId))
      .where(eq(competitionMatches.refereeUserId,userId));
    const teamIds=[...new Set(records.flatMap(r=>[r.match.homeTeamId,r.match.awayTeamId]).filter((v):v is string=>!!v))];
    const teamNames=teamIds.length?await this.db.select({id:teams.id,name:teams.name}).from(teams)
      .where(inArray(teams.id,teamIds)):[];
    const names=new Map(teamNames.map(t=>[t.id,t.name]));
    const responseIds=records.map(r=>r.match.id);
    const responses=responseIds.length?await this.db.select().from(refereeMatchResponses)
      .where(and(eq(refereeMatchResponses.refereeUserId,userId),
        inArray(refereeMatchResponses.matchId,responseIds))):[];
    const byId=new Map(responses.map(r=>[r.matchId,r]));
    const allowedVenues=new Set(allowed.map(v=>v.id));
    return records.map(({match,competitionName,format,duration,venueName,venueAddress,latitude,longitude})=>{
      const reply=byId.get(match.id);
      const authorized=allowedVenues.has(match.venueId??"");
      return {
        id:match.id,competitionId:match.competitionId,competitionName,format,
        homeTeamId:match.homeTeamId,awayTeamId:match.awayTeamId,
        homeTeamName:names.get(match.homeTeamId??"")??"TBD",
        awayTeamName:names.get(match.awayTeamId??"")??"TBD",
        venueId:match.venueId,venueName,venueAddress,latitude,longitude,
        startsAt:match.startsAt?.toISOString()??null,
        endsAt:match.endsAt?.toISOString()??null,durationMinutes:duration,
        matchStatus:match.status,homeScore:match.homeScore,awayScore:match.awayScore,
        responseStatus:reply?.status??"PENDING",
        responseReason:reply?.reason??null,
        respondedAt:reply?.respondedAt?.toISOString()??null,
        authorized,
      };
    }).sort((a,b)=>(a.startsAt??"").localeCompare(b.startsAt??""));
  }
  async overview(userId:string){
    const [identity,matches,profile]=await Promise.all([
      this.authorization(userId),this.assignments(userId),this.profile(userId)]);
    const confirmed=matches.filter(m=>m.responseStatus==="ACCEPTED");
    const completed=confirmed.filter(m=>["COMPLETED","CORRECTED"].includes(m.matchStatus));
    const pending=matches.filter(m=>m.responseStatus==="PENDING"&&m.authorized&&
      m.matchStatus==="SCHEDULED"&&!!m.startsAt&&Date.parse(m.startsAt)>this.now().getTime());
    const upcoming=confirmed.filter(m=>m.authorized&&m.matchStatus==="SCHEDULED"&&!!m.startsAt&&
      Date.parse(m.startsAt)>this.now().getTime());
    return {person:identity.person,venues:identity.venues,profile,
      assignments:matches,
      stats:{total:completed.length,upcoming:upcoming.length,pending:pending.length,
        completed:completed.length,accepted:confirmed.length,
        declined:matches.filter(m=>m.responseStatus==="DECLINED").length},
      nextMatch:upcoming[0]??null};
  }
  async profile(userId:string){
    await this.authorization(userId);
    const [row]=await this.db.select().from(refereeProfiles).where(eq(refereeProfiles.userId,userId)).limit(1);
    return {level:row?.level??null,experienceYears:row?.experienceYears??0,
      biography:row?.biography??null,
      weeklyAvailability:row?.weeklyAvailability??[],
      exceptions:row?.exceptions??[]};
  }
  async saveProfile(userId:string,raw:z.infer<typeof refereeProfileSchema>){
    await this.authorization(userId);
    const data={...raw,updatedAt:this.now()};
    await this.db.insert(refereeProfiles).values({userId,...data})
      .onConflictDoUpdate({target:refereeProfiles.userId,set:data});
    return {profile:await this.profile(userId)};
  }
  async organizerAssignments(ownerId:string,competitionId:string){
    const [c]=await this.db.select({id:competitions.id}).from(competitions)
      .innerJoin(venues,eq(venues.id,competitions.venueId))
      .where(and(eq(competitions.id,competitionId),eq(venues.ownerUserId,ownerId))).limit(1);
    if(!c)throw errors.forbidden("COMPETITION_OWNER_REQUIRED","Only the competition owner can inspect assignments.");
    const matches=await this.db.select({id:competitionMatches.id,refereeUserId:competitionMatches.refereeUserId,
      startsAt:competitionMatches.startsAt}).from(competitionMatches)
      .where(eq(competitionMatches.competitionId,competitionId));
    const ids=matches.map(m=>m.id);
    const responses=ids.length?await this.db.select().from(refereeMatchResponses)
      .where(inArray(refereeMatchResponses.matchId,ids)):[];
    const byKey=new Map(responses.map(r=>[r.matchId+":"+r.refereeUserId,r]));
    return {assignments:matches.map(m=>({
      matchId:m.id,refereeUserId:m.refereeUserId,
      status:m.refereeUserId?byKey.get(m.id+":"+m.refereeUserId)?.status??"PENDING":null,
      reason:m.refereeUserId?byKey.get(m.id+":"+m.refereeUserId)?.reason??null:null,
    }))};
  }
  async respond(userId:string,matchId:string,input:z.infer<typeof replySchema>){
    const now=this.now();
    return this.db.transaction(async tx=>{
      // Serializes all acceptance checks by this referee across different matches.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
      const [row]=await tx.select({
        match:competitionMatches,venueId:competitions.venueId,
      }).from(competitionMatches)
        .innerJoin(competitions,eq(competitions.id,competitionMatches.competitionId))
        .where(and(eq(competitionMatches.id,matchId),eq(competitionMatches.refereeUserId,userId)))
        .limit(1);
      if(!row)throw errors.forbidden("REFEREE_MATCH_REQUIRED","You are not assigned to this match.");
      const {match,venueId}=row;
      const [authorized]=await tx.select({userId:venueReferees.userId}).from(venueReferees)
        .where(and(eq(venueReferees.venueId,venueId),eq(venueReferees.userId,userId))).limit(1);
      if(!authorized)throw errors.forbidden("REFEREE_VENUE_REQUIRED","You no longer have permission at this venue.");
      const [previous]=await tx.select().from(refereeMatchResponses).where(and(
        eq(refereeMatchResponses.matchId,matchId),eq(refereeMatchResponses.refereeUserId,userId))).limit(1);
      const status=previous?.status??"PENDING";
      // Past and finished matches cannot have their appointment state rewritten.
      if((input.action==="DECLINED"||input.action==="WITHDRAW_REQUESTED")&&
        (match.status!=="SCHEDULED"||!match.startsAt||match.startsAt<=now))
        throw errors.conflict("REFEREE_INVITATION_CLOSED","This match is no longer open for appointment changes.");
      if(input.action==="ACCEPTED"){
        if(status==="ACCEPTED")return {status};
        if(status!=="PENDING")throw errors.conflict("REFEREE_INVITATION_CLOSED","This assignment must be reissued by its organizer.");
        if(match.status!=="SCHEDULED"||!match.startsAt||!match.endsAt||match.startsAt<=now)
          throw errors.conflict("MATCH_NOT_READY","This match is no longer available for acceptance.");
        const [profile]=await tx.select().from(refereeProfiles).where(eq(refereeProfiles.userId,userId)).limit(1);
        if(!availabilityAllows(match.startsAt,match.endsAt,
          profile?.weeklyAvailability??[],profile?.exceptions??[]))
          throw errors.conflict("REFEREE_UNAVAILABLE_TIME","Your configured availability excludes this match.");
        const conflicts=await tx.select({id:competitionMatches.id}).from(competitionMatches)
          .innerJoin(refereeMatchResponses,and(
            eq(refereeMatchResponses.matchId,competitionMatches.id),
            eq(refereeMatchResponses.refereeUserId,userId),
            eq(refereeMatchResponses.status,"ACCEPTED")))
          .where(and(neMatch(matchId),eq(competitionMatches.refereeUserId,userId),
            inArray(competitionMatches.status,["SCHEDULED","IN_PROGRESS"]),
            lt(competitionMatches.startsAt,match.endsAt),gt(competitionMatches.endsAt,match.startsAt)))
          .limit(1);
        if(conflicts.length)throw errors.conflict("REFEREE_TIME_CONFLICT","You have another confirmed match at this time.");
        const teamIds=[match.homeTeamId,match.awayTeamId].filter((v):v is string=>!!v);
        if(!teamIds.length)throw errors.conflict("MATCH_TEAMS_PENDING","The match teams are not finalized.");
        const [playing,managing]=await Promise.all([
          tx.select({userId:teamMemberships.userId}).from(teamMemberships).where(and(
            eq(teamMemberships.userId,userId),inArray(teamMemberships.teamId,teamIds),
            eq(teamMemberships.status,"ACTIVE"))).limit(1),
          tx.select({id:teams.id}).from(teams).where(and(inArray(teams.id,teamIds),
            eq(teams.managerUserId,userId))).limit(1),
        ]);
        if(playing.length||managing.length)throw errors.conflict("REFEREE_CONFLICT_OF_INTEREST","You cannot referee your own team.");
      }else if(input.action==="WITHDRAW_REQUESTED"&&status!=="ACCEPTED"){
        throw errors.conflict("REFEREE_NOT_CONFIRMED","Only confirmed assignments can request withdrawal.");
      }else if(input.action==="DECLINED"&&status!=="PENDING"){
        throw errors.conflict("REFEREE_NOT_PENDING","Only pending invitations can be declined.");
      }
      const values={status:input.action,reason:input.reason?.trim()||null,
        respondedAt:now,updatedAt:now};
      await tx.insert(refereeMatchResponses).values({matchId,refereeUserId:userId,...values})
        .onConflictDoUpdate({target:[refereeMatchResponses.matchId,refereeMatchResponses.refereeUserId],set:values});
      return {status:input.action};
    });
  }
}
// Keep the SQL predicate explicit; Drizzle aliases are not needed for the match ID exclusion.
function neMatch(matchId:string){return sql`${competitionMatches.id} <> ${matchId}`;}
export function createRefereeRouter(service:RefereeService,tokens:TokenService){
  const router=Router(),auth=requireAuth(tokens);
  const limit=rateLimit({windowMs:60_000,limit:35,standardHeaders:"draft-8",legacyHeaders:false});
  const handle=(fn:(uid:string,req:Request)=>Promise<unknown>)=>async(req:Request,res:Response,next:NextFunction)=>{
    try{res.json(await fn(req.auth!.userId,req));}catch(e){next(e);}
  };
  router.get("/referee/overview",auth,handle(user=>service.overview(user)));
  router.get("/referee/profile",auth,handle(async user=>({profile:await service.profile(user)})));
  router.put("/referee/profile",auth,limit,handle((user,req)=>
    service.saveProfile(user,refereeProfileSchema.parse(req.body))));
  router.post("/referee/assignments/:matchId/respond",auth,limit,handle((user,req)=>
    service.respond(user,uuid.parse(req.params.matchId),replySchema.parse(req.body))));
  return router;
}
// Report review endpoints are reserved for Phase 2; never expose unauthenticated placeholders.
export function createOwnerRefereeReportRouter(service:RefereeService,tokens:TokenService){
  const router=Router(),auth=requireAuth(tokens);
  router.get("/referee-assignments/:competitionId",auth,async(req,res,next)=>{
    try{res.json(await service.organizerAssignments(req.auth!.userId,uuid.parse(req.params.competitionId)));}
    catch(e){next(e);}
  });
  return router;
}
