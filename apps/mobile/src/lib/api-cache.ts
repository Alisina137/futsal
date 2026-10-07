import AsyncStorage from "@react-native-async-storage/async-storage";

type CachePolicy = {
  ttlMs: number;
  persist: boolean;
};

type CacheEntry<T> = {
  value: T;
  cachedAt: number;
};

const STORAGE_PREFIX = "futsal.api-read-cache.v1";
const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightReads = new Map<string, Promise<unknown>>();
let activeUserId: string | null = null;
let cacheEpoch = 0;

export function setApiCacheUserScope(userId: string | null) {
  activeUserId = userId;
}

function scopeFor(accessToken?: string) {
  if (!accessToken) return "public";
  return activeUserId ? `user:${activeUserId}` : null;
}

function pathOnly(path: string) {
  return path.split("?")[0] ?? path;
}

function cachePolicy(path: string, accessToken?: string): CachePolicy | null {
  const pathname = pathOnly(path);

  // Security- and identity-sensitive reads must always come from the server.
  if (
    pathname === "/health"
    || pathname === "/ready"
    || pathname.startsWith("/api/v1/auth/")
    || pathname === "/api/v1/users/me"
    || pathname.startsWith("/api/v1/admin/")
  ) return null;

  // Availability is intentionally excluded: booking inventory must remain live.
  // Its existing dedicated cache is read-only fallback/orientation data.
  if (pathname.includes("/availability")) return null;

  // Public/read-mostly data can survive app restarts.
  if (pathname === "/api/v1/venues") return { ttlMs: 5 * 60_000, persist: true };
  if (/^\/api\/v1\/venues\/[^/]+$/.test(pathname)) return { ttlMs: 2 * 60_000, persist: true };
  if (pathname === "/api/v1/competitions" || pathname.startsWith("/api/v1/competitions/")) {
    return { ttlMs: 60_000, persist: true };
  }
  if (/^\/api\/v1\/players\/[^/]+$/.test(pathname)) return { ttlMs: 2 * 60_000, persist: true };
  if (pathname === "/api/v1/teams/mine" || pathname.includes("/invitations")) {
    return { ttlMs: 20_000, persist: false };
  }
  if (pathname === "/api/v1/teams" || /^\/api\/v1\/teams\/[^/]+$/.test(pathname)) {
    return { ttlMs: 60_000, persist: true };
  }
  if (pathname === "/api/v1/feed" || pathname === "/api/v1/feed/following") {
    return { ttlMs: 45_000, persist: true };
  }

  // Personalized social content is public-style content plus viewer interaction
  // state. It is safe to persist only inside the authenticated user's scope.
  if (pathname === "/api/v1/social/feed" && accessToken) {
    return { ttlMs: 30_000, persist: true };
  }

  // Private/operational reads get an in-memory cache only. This removes repeated
  // fetching while navigating without writing customer, billing, notification,
  // or owner-operation data to unencrypted AsyncStorage.
  if (pathname.startsWith("/api/v1/owner/")) return { ttlMs: 20_000, persist: false };
  if (pathname === "/api/v1/bookings/me") return { ttlMs: 15_000, persist: false };
  if (pathname.startsWith("/api/v1/notifications")) return { ttlMs: 10_000, persist: false };
  return null;
}

function storageKey(scope: string, path: string) {
  return `${STORAGE_PREFIX}|${scope}|${path}`;
}

function isNetworkFailure(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  return code === "NETWORK_ERROR" || code === "TIMEOUT";
}

async function readPersistent<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheEntry<T>>;
    if (typeof parsed.cachedAt !== "number" || !("value" in parsed)) return null;
    return { value: parsed.value as T, cachedAt: parsed.cachedAt };
  } catch {
    await AsyncStorage.removeItem(key).catch(() => undefined);
    return null;
  }
}

async function writePersistent<T>(key: string, entry: CacheEntry<T>) {
  await AsyncStorage.setItem(key, JSON.stringify(entry)).catch(() => undefined);
}

async function removeKeysMatching(predicate: (key: string) => boolean) {
  for (const key of [...memoryCache.keys()]) {
    if (predicate(key)) memoryCache.delete(key);
  }
  for (const key of [...inFlightReads.keys()]) {
    if (predicate(key)) inFlightReads.delete(key);
  }
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as string[])).filter((key) =>
    key.startsWith(`${STORAGE_PREFIX}|`) && predicate(key)
  );
  if (keys.length) await AsyncStorage.multiRemove(keys).catch(() => undefined);
}

async function clearScope(scope: string) {
  cacheEpoch += 1;
  const prefix = `${STORAGE_PREFIX}|${scope}|`;
  await removeKeysMatching((key) => key.startsWith(prefix));
}

async function clearPublicPrefixes(prefixes: string[]) {
  if (!prefixes.length) return;
  cacheEpoch += 1;
  const base = `${STORAGE_PREFIX}|public|`;
  await removeKeysMatching((key) =>
    key.startsWith(base) && prefixes.some((prefix) => key.slice(base.length).startsWith(prefix))
  );
}

function publicPrefixesAffectedBy(path: string) {
  const pathname = pathOnly(path);
  const prefixes: string[] = [];

  if (pathname.startsWith("/api/v1/teams")) prefixes.push("/api/v1/teams");
  if (pathname.includes("/competitions")) prefixes.push("/api/v1/competitions");
  if (pathname.startsWith("/api/v1/owner/onboarding")) prefixes.push("/api/v1/venues");
  if (pathname.startsWith("/api/v1/owner/posts") || pathname.startsWith("/api/v1/owner/promotions")) {
    prefixes.push("/api/v1/feed");
  }

  return prefixes;
}

export async function cachedApiRead<T>(
  path: string,
  accessToken: string | undefined,
  loader: () => Promise<T>,
): Promise<T> {
  const policy = cachePolicy(path, accessToken);
  const scope = scopeFor(accessToken);
  if (!policy || !scope) return loader();

  const key = storageKey(scope, path);
  let cached = memoryCache.get(key) as CacheEntry<T> | undefined;

  if (!cached && policy.persist) {
    const persisted = await readPersistent<T>(key);
    if (persisted) {
      cached = persisted;
      memoryCache.set(key, persisted);
    }
  }

  if (cached && Date.now() - cached.cachedAt <= policy.ttlMs) {
    return cached.value;
  }

  const existing = inFlightReads.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const requestEpoch = cacheEpoch;
  let request: Promise<T>;
  request = (async () => {
    try {
      const value = await loader();
      if (cacheEpoch === requestEpoch) {
        const entry: CacheEntry<T> = { value, cachedAt: Date.now() };
        memoryCache.set(key, entry);
        if (policy.persist) await writePersistent(key, entry);
      }
      return value;
    } catch (error) {
      // Stale cache is a network-only fallback. Authorization, suspension,
      // validation, and server business-rule errors are never hidden.
      if (cached && isNetworkFailure(error)) return cached.value;
      throw error;
    } finally {
      if (inFlightReads.get(key) === request) inFlightReads.delete(key);
    }
  })();

  inFlightReads.set(key, request);
  return request;
}

export async function invalidateApiCacheAfterMutation(path: string, accessToken?: string) {
  const scope = scopeFor(accessToken);

  // Any successful authenticated write can affect the current user's views.
  // Clearing that user's cached reads is deliberately broad and correctness-first.
  if (scope && scope !== "public") await clearScope(scope);

  const publicPrefixes = publicPrefixesAffectedBy(path);
  if (publicPrefixes.length) await clearPublicPrefixes(publicPrefixes);
}

export async function clearActiveUserApiCache() {
  const userId = activeUserId;
  activeUserId = null;
  if (userId) await clearScope(`user:${userId}`);
}

export async function clearAllApiReadCache() {
  activeUserId = null;
  cacheEpoch += 1;
  inFlightReads.clear();
  await removeKeysMatching((key) => key.startsWith(`${STORAGE_PREFIX}|`));
}
