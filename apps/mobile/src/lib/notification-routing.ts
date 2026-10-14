/**
 * Native push payloads are external input, even when our API normally creates them.
 * Permit only known in-app screens; reject schemes, protocol-relative URLs,
 * traversal, fragments and malformed percent encoding before Expo Router sees them.
 */
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const allowedRoutes=[
  /^\/(?:notifications|bookings|dashboard|home|venues|teams|competitions|support)$/,
  /^\/owner\/schedule$/,
  /^\/teams\/invitations$/,
  new RegExp(`^/teams/${uuid}(?:/(?:manage|activities|announcements))?$`,"i"),
  new RegExp(`^/(?:venues|posts|competitions)/${uuid}$`,"i"),
];
export function safeNotificationDeepLink(value:unknown):string|null{
  if(typeof value!=="string"||value.length>350||!value.startsWith("/")||
    value.startsWith("//")||value.includes("\\")||value.includes("#"))return null;
  const [pathname,...queryParts]=value.split("?");
  if(queryParts.length>1||!pathname||!allowedRoutes.some(pattern=>pattern.test(pathname))||
    pathname.includes(".."))return null;
  const query=queryParts[0];
  if(query!==undefined){
    if(query.length>200||!/^[a-zA-Z0-9._~%&=:+\-]*$/.test(query)||
      /%(?![0-9a-fA-F]{2})/.test(query))return null;
  }
  return value;
}
