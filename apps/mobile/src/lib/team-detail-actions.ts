/**
 * Public Team Detail actions mirror server membership eligibility:
 * new join requests require verified email and zero assigned roles.
 * Pending requests remain cancellable even if eligibility later changes.
 */
export type TeamDetailJoinAction=
  "none"|"request"|"cancel"|"verifyEmail"|"roleRestricted"|"invitationOnly"|"signIn";

export function teamDetailJoinAction(input:{
  signedIn:boolean;emailVerified:boolean;hasAssignedRole:boolean;
  member:boolean;manager:boolean;pending:boolean;allowJoinRequests:boolean;
}):TeamDetailJoinAction{
  if(input.member||input.manager)return "none";
  if(input.pending&&input.signedIn)return "cancel";
  if(!input.signedIn)return "signIn";
  if(!input.emailVerified)return "verifyEmail";
  if(input.hasAssignedRole)return "roleRestricted";
  if(!input.allowJoinRequests)return "invitationOnly";
  return "request";
}

/** Unavailable follower counts must not be represented as a real zero. */
export function displayTeamFollowerCount(count:number|undefined|null):string{
  return typeof count==="number"&&Number.isSafeInteger(count)&&count>=0?String(count):"—";
}

/** Only a deliberately published, well-formed phone number may be dialed. */
export function publicTeamTelephoneUrl(phone:string|null|undefined):string|null{
  if(!phone)return null;
  const normalized=phone.trim().replace(/[\s\-().]/g,"");
  if(!/^\+?[0-9]{7,15}$/.test(normalized))return null;
  return "tel:"+normalized;
}
