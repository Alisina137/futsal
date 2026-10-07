import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function requireText(content, marker, message) {
  if (!content.includes(marker)) throw new Error(`${message}: ${marker}`);
}

const cache = read("apps/mobile/src/lib/api-cache.ts");
const api = read("apps/mobile/src/lib/api.ts");
const auth = read("apps/mobile/src/providers/AuthProvider.tsx");
const availability = read("apps/mobile/src/lib/availability-cache.ts");

for (const marker of [
  '@react-native-async-storage/async-storage',
  'STORAGE_PREFIX = "futsal.api-read-cache.v1"',
  "memoryCache = new Map",
  "inFlightReads = new Map",
  "setApiCacheUserScope",
  "cachedApiRead",
  "invalidateApiCacheAfterMutation",
  "clearActiveUserApiCache",
]) requireText(cache, marker, "Mobile API cache foundation missing");

for (const marker of [
  'pathname.startsWith("/api/v1/auth/")',
  'pathname === "/api/v1/users/me"',
  'pathname.startsWith("/api/v1/admin/")',
  'pathname.includes("/availability")',
]) requireText(cache, marker, "Sensitive/live endpoint cache exclusion missing");

for (const marker of [
  'pathname === "/api/v1/venues"',
  'pathname === "/api/v1/competitions"',
  'pathname === "/api/v1/social/feed"',
  'persist: true',
]) requireText(cache, marker, "Persistent read-mostly cache policy missing");

requireText(
  cache,
  'pathname.startsWith("/api/v1/owner/") return { ttlMs: 20_000, persist: false }',
  "Owner operational data must remain memory-only",
);
requireText(
  cache,
  'pathname === "/api/v1/teams/mine" || pathname.includes("/invitations")',
  "Private team reads must remain memory-only",
);
requireText(cache, "if (existing) return existing;", "Duplicate in-flight GET requests must be deduplicated");
requireText(cache, "if (cached && isNetworkFailure(error)) return cached.value;", "Stale fallback must be network-only");
requireText(cache, "await clearScope(scope);", "Successful writes must invalidate current-user cache");

for (const marker of [
  'import { cachedApiRead, invalidateApiCacheAfterMutation } from "./api-cache";',
  "return cachedApiRead(path, accessToken",
  "await invalidateApiCacheAfterMutation(path, accessToken);",
]) requireText(api, marker, "Shared API layer is not wired to the cache");

for (const marker of [
  'setApiCacheUserScope(next.user.id)',
  'setApiCacheUserScope(stored.user.id)',
  "clearActiveUserApiCache()",
]) requireText(auth, marker, "Auth lifecycle is not scoping/clearing cached reads");

for (const marker of [
  "writeAvailabilityCache",
  "readAvailabilityCache",
]) requireText(availability, marker, "Dedicated live-availability fallback cache must remain present");

console.log("Mobile data cache verified: scoped memory/persistent reads, duplicate-request dedupe, network-only stale fallback, mutation invalidation, privacy exclusions, and auth lifecycle cleanup are present.");
