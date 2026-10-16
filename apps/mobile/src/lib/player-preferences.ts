import type {PlayerDashboardPreferences} from "./api";
export type PlayerPreferenceDraft=PlayerDashboardPreferences;
/** Remove whitespace-only optional fields before server writes. */
export function normalizePlayerPreferences(input:PlayerPreferenceDraft):PlayerPreferenceDraft{
  const clean=(value:string|null)=>value?.trim()||null;
  return {
    defaultTeamId:input.defaultTeamId||null,
    biography:clean(input.biography),
    province:clean(input.province),
    district:clean(input.district),
    secondaryPosition:input.secondaryPosition||null,
    preferredFoot:input.preferredFoot||null,
  };
}
export function playerPreferencesChanged(current:PlayerPreferenceDraft,saved:PlayerPreferenceDraft){
  const a=normalizePlayerPreferences(current),b=normalizePlayerPreferences(saved);
  return (Object.keys(a) as Array<keyof PlayerPreferenceDraft>)
    .some(key=>a[key]!==b[key]);
}
export function playerPreferencesValid(input:PlayerPreferenceDraft){
  const clean=normalizePlayerPreferences(input);
  return (clean.biography?.length??0)<=500&&
    (clean.province?.length??0)<=80&&(clean.district?.length??0)<=80;
}
