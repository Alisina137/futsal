import type {CompetitionListItemDto, ManualTeamDto} from "@leaguekick/contracts";

/** Match names entered with different spacing, case or Unicode presentation. */
export function normalizeOfflineText(value:string){
  return value.normalize("NFKC").trim().replace(/\s+/gu," ").toLocaleLowerCase();
}

export function duplicateOfflineTeam(
  teams:readonly ManualTeamDto[],name:string,city:string,editingId:string|null=null,
){
  const nameKey=normalizeOfflineText(name),cityKey=normalizeOfflineText(city);
  return teams.find(team=>team.id!==editingId
    &&normalizeOfflineText(team.name)===nameKey
    &&normalizeOfflineText(team.city)===cityKey)??null;
}

export function searchOfflineTeams(
  teams:readonly ManualTeamDto[],query:string,city:string,
){
  const q=normalizeOfflineText(query),c=normalizeOfflineText(city);
  return teams.filter(team=>(!c||normalizeOfflineText(team.city)===c)
    &&(!q||normalizeOfflineText(team.name).includes(q)
      ||normalizeOfflineText(team.city).includes(q)))
    .sort((a,b)=>a.name.localeCompare(b.name)||a.city.localeCompare(b.city)||a.id.localeCompare(b.id));
}

/** The backend is authoritative; these are preliminary organizer options only.
 * A just-started match, recent team admission or another organizer's action
 * may make an apparently eligible competition reject the registration. */
export function registerableOwnerCompetitions(competitions:readonly CompetitionListItemDto[]){
  return competitions.filter(item=>
    (item.status==="DRAFT"||item.status==="REGISTRATION_OPEN"
      ||item.status==="REGISTRATION_CLOSED")
    &&item.acceptedTeams<item.maxTeams,
  ).sort((a,b)=>{
    const ax=a.startsAt?Date.parse(a.startsAt):NaN;
    const bx=b.startsAt?Date.parse(b.startsAt):NaN;
    return (Number.isFinite(ax)?ax:Number.POSITIVE_INFINITY)
      -(Number.isFinite(bx)?bx:Number.POSITIVE_INFINITY)
      ||a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
  });
}
