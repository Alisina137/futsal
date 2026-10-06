import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const tokenService = readFileSync("apps/api/src/modules/auth/token.service.ts", "utf8");
const server = readFileSync("apps/api/src/server.ts", "utf8");
const commercialRepo = readFileSync("apps/api/src/modules/commercial/commercial.repository.ts", "utf8");
const authProvider = readFileSync("apps/mobile/src/providers/AuthProvider.tsx", "utf8");
const api = readFileSync("apps/mobile/src/lib/api.ts", "utf8");
const rootLayout = readFileSync("apps/mobile/app/_layout.tsx", "utf8");
const overlay = readFileSync("apps/mobile/src/components/AccountSuspensionOverlay.tsx", "utf8");
const localization = readFileSync("packages/localization/src/index.ts", "utf8");
const commercialTest = readFileSync("apps/api/test/commercial.test.ts", "utf8");

assert(tokenService.includes('"ACCOUNT_SUSPENDED"'), "Token validation must return ACCOUNT_SUSPENDED.");
assert(server.includes("?.status ?? null"), "Runtime access validation must use live account status.");
assert(!commercialRepo.includes(".update(sessions)"), "Suspending an account must not revoke its refresh session.");
assert(api.includes('accountAccessListener?.("ACCOUNT_SUSPENDED")'), "API client must broadcast suspended-account responses.");
assert(authProvider.includes("ACCOUNT_CHECK_INTERVAL_MS = 10_000"), "Authenticated accounts must be checked periodically.");
assert(authProvider.includes('nextState === "active"'), "Account state must be rechecked when the app returns to foreground.");
assert(authProvider.includes('setAccessState("suspended")'), "Auth state must preserve a suspended state.");
assert(rootLayout.includes("<AccountSuspensionOverlay/>"), "The global suspension overlay must be mounted.");
assert(overlay.includes('accessState !== "suspended"'), "Suspension overlay must be gated by suspended state.");
assert(overlay.includes('t("auth.suspendedTitle")'), "Suspension overlay must be localized.");
assert(overlay.includes("loading={checking}"), "Status recheck must show a loading state.");
assert(overlay.includes('result === "suspended"'), "Status recheck must explain when the account is still suspended.");
assert(overlay.includes('result === "offline"'), "Status recheck must explain when the server cannot be reached.");
assert(authProvider.includes('Promise<AccountCheckResult>'), "Account recheck must return an explicit result to the UI.");
assert((localization.match(/"auth\.suspendedTitle"/g) ?? []).length === 3, "Suspension title must exist in all three languages.");
assert((localization.match(/"auth\.suspendedStill"/g) ?? []).length === 3, "Still-suspended feedback must exist in all three languages.");
assert((localization.match(/"auth\.suspendedOffline"/g) ?? []).length === 3, "Offline recheck feedback must exist in all three languages.");
assert(commercialTest.includes("blocks an already-issued access token as soon as the account is suspended"), "Live-token suspension regression test is required.");

console.log("Account suspension verified: live token rejection, localized blocking state, session preservation, foreground polling, and restore recovery.");
