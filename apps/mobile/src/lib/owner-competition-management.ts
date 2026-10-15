import type {CompetitionDto,CompetitionListItemDto,CompetitionFormat} from "@leaguekick/contracts";

export type OwnerCompetitionGroup="ALL"|"REGISTRATION"|"ACTIVE"|"DRAFTS"|"FINISHED";
export type OwnerCompetitionOrder="NEXT"|"LATEST"|"NAME";
export const ownerCompetitionGroups:readonly OwnerCompetitionGroup[]=[
  "ALL","REGISTRATION","ACTIVE","DRAFTS","FINISHED",
];
export const ownerCompetitionOrders:readonly OwnerCompetitionOrder[]=["NEXT","LATEST","NAME"];

const ACTIVE=["REGISTRATION_OPEN","REGISTRATION_CLOSED","SCHEDULED","IN_PROGRESS"];
const FINISHED=["COMPLETED","ARCHIVED","CANCELLED"];
export function ownerCompetitionGroup(status:string):OwnerCompetitionGroup{
  if(status==="DRAFT")return "DRAFTS";
  if(status==="REGISTRATION_OPEN")return "REGISTRATION";
  if(FINISHED.includes(status))return "FINISHED";
  return "ACTIVE";
}

/** Local presentation filters over an owner-authenticated server list.
 * No private application/fixture counts are inferred from this summary DTO. */
export function selectOwnerCompetitions(
  items:readonly CompetitionListItemDto[],
  filters:{group:OwnerCompetitionGroup;status:string;format:"ALL"|CompetitionFormat;
    query:string;order:OwnerCompetitionOrder},nowMs:number,
):CompetitionListItemDto[]{
  const query=filters.query.trim().toLocaleLowerCase();
  const source=items.filter(item=>
    (filters.group==="ALL"||(filters.group==="REGISTRATION"
      ?item.status==="REGISTRATION_OPEN"
      :filters.group==="ACTIVE"?ACTIVE.includes(item.status)
      :ownerCompetitionGroup(item.status)===filters.group))
    &&(filters.status==="ALL"||item.status===filters.status)
    &&(filters.format==="ALL"||item.format===filters.format)
    &&(!query||[item.name,item.venueName,item.format,item.status].some(
      value=>value.toLocaleLowerCase().includes(query)))
  );
  const start=(item:CompetitionListItemDto)=>{
    const date=item.startsAt?Date.parse(item.startsAt):NaN;
    return Number.isFinite(date)?date:Number.POSITIVE_INFINITY;
  };
  return source.sort((a,b)=>{
    if(filters.order==="NAME")return a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
    if(filters.order==="NEXT"){
      const ax=start(a),bx=start(b);
      // Future starts first; already-started or unscheduled go below.
      const af=ax>=nowMs?ax:Number.POSITIVE_INFINITY;
      const bf=bx>=nowMs?bx:Number.POSITIVE_INFINITY;
      return af-bf||a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
    }
    const ax=start(a),bx=start(b);
    const aSort=Number.isFinite(ax)?ax:Number.NEGATIVE_INFINITY;
    const bSort=Number.isFinite(bx)?bx:Number.NEGATIVE_INFINITY;
    return bSort-aSort||a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
  });
}

export function ownerCompetitionOverviewCounts(items:readonly CompetitionListItemDto[]){
  return {
    total:items.length,
    active:items.filter(item=>ACTIVE.includes(item.status)).length,
    registrationsOpen:items.filter(item=>item.status==="REGISTRATION_OPEN").length,
    drafts:items.filter(item=>item.status==="DRAFT").length,
  };
}

/** Use full authenticated owner detail for team requests/fixture actions,
 * never the public list or the public competition detail. */
export function ownerCompetitionOperations(detail:CompetitionDto,nowMs:number){
  const awaiting=detail.teams.filter(team=>team.status==="APPLIED"||team.status==="PENDING");
  const accepted=detail.teams.filter(team=>team.status==="ACCEPTED");
  const fixtures=detail.matches.filter(match=>match.status==="SCHEDULED"
    ||match.status==="IN_PROGRESS"||match.status==="POSTPONED"
    ||match.status==="UNSCHEDULED");
  const unassigned=fixtures.filter(match=>match.homeTeamId&&match.awayTeamId
    &&!match.refereeUserId&&match.status!=="POSTPONED");
  const next=fixtures.filter(match=>match.startsAt
      && (match.status==="IN_PROGRESS"||Date.parse(match.startsAt)>=nowMs)
      &&match.status!=="POSTPONED")
    .sort((a,b)=>Date.parse(a.startsAt!)-Date.parse(b.startsAt!))[0]??null;
  return {
    pendingApplications:awaiting.length,
    acceptedTeams:accepted.length,
    unassignedFixtures:unassigned.length,
    unfinishedFixtures:fixtures.length,
    nextMatch:next,
  };
}
