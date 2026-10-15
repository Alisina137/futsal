import type {TeamJoinRequestStatus} from "@leaguekick/contracts";
import type {TeamDetailJoinAction} from "./team-detail-actions";

export type TeamAboutMembershipState=
  "manager"|"captain"|"player"|"pending"|"signIn"|"verifyEmail"|
  "roleRestricted"|"invitationOnly"|"rejected"|"cancelled"|"eligible";

/** Status presentation only. Actions/permissions remain server-authoritative. */
export function teamAboutMembershipState(input:{
  role:"MANAGER"|"CAPTAIN"|"PLAYER"|null;
  joinStatus:TeamJoinRequestStatus|null;
  action:TeamDetailJoinAction;
}):TeamAboutMembershipState{
  if(input.role==="MANAGER")return "manager";
  if(input.role==="CAPTAIN")return "captain";
  if(input.role==="PLAYER")return "player";
  if(input.action==="cancel"||input.joinStatus==="PENDING")return "pending";
  if(input.action==="signIn")return "signIn";
  if(input.action==="verifyEmail")return "verifyEmail";
  if(input.action==="roleRestricted")return "roleRestricted";
  if(input.action==="invitationOnly")return "invitationOnly";
  if(input.joinStatus==="REJECTED"&&input.action==="request")return "rejected";
  if(input.joinStatus==="CANCELLED"&&input.action==="request")return "cancelled";
  return "eligible";
}

/** Render the public city/district/province without repeated place labels. */
export function teamAboutLocation(city:string, district?:string|null,province?:string|null):string{
  const parts=[city,district,province].map(part=>part?.trim()??"").filter(Boolean);
  return parts.filter((part,index)=>parts.findIndex(other=>other.toLocaleLowerCase()===
    part.toLocaleLowerCase())===index).join(" · ");
}

/** Founded date is a calendar date, not a midnight timestamp to convert. */
export function teamAboutFoundedDate(value:string|null|undefined,language:"en"|"fa-AF"|"ps-AF"):string|null{
  if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const date=new Date(value+"T12:00:00Z");
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)return null;
  return new Intl.DateTimeFormat(language==="en"?"en-GB":language,{
    calendar:"gregory",timeZone:"UTC",day:"numeric",month:"long",year:"numeric",
  }).format(date);
}

export function teamAboutVenueLink(teamPrivacy:string,homeVenueId:string|null|undefined):string|null{
  if(teamPrivacy!=="PUBLIC"||!homeVenueId)return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(homeVenueId)
    ?homeVenueId:null;
}

/** Private member routes are only linked for a verified current roster/manager. */
export function mayOpenTeamMemberArea(input:{
  member:boolean;isManager:boolean;
}):boolean{
  return input.member||input.isManager;
}
