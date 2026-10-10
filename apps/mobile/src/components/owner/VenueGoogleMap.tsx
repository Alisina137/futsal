// TypeScript's platform-neutral resolver needs a base entry.
// Metro resolves VenueGoogleMap.native.tsx on Android/iOS and
// VenueGoogleMap.web.tsx in browsers before considering this fallback.
export {VenueGoogleMap} from "./VenueGoogleMap.web";
