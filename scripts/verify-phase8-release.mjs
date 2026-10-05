import { existsSync, readFileSync, statSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function requireText(content, marker, message) {
  if (!content.includes(marker)) throw new Error(`${message}: ${marker}`);
}
function requireFile(path, message) {
  const url = new URL(`../${path}`, import.meta.url);
  if (!existsSync(url)) throw new Error(`${message}: ${path}`);
  return url;
}

const appConfig = read("apps/mobile/app.json");
const eas = read("apps/mobile/eas.json");
const runtime = read("apps/api/src/runtime-config.ts");
const apiApp = read("apps/api/src/app.ts");
const server = read("apps/api/src/server.ts");
const mobileApi = read("apps/mobile/src/lib/api.ts");
const auth = read("apps/mobile/src/providers/AuthProvider.tsx");
const root = read("apps/mobile/app/_layout.tsx");
const support = read("apps/mobile/app/(app)/support.tsx");
const settings = read("apps/mobile/app/(app)/(tabs)/settings.tsx");
const button = read("apps/mobile/src/components/ui/Button.tsx");
const field = read("apps/mobile/src/components/ui/TextField.tsx");
const text = read("apps/mobile/src/components/ui/AppText.tsx");
const network = read("apps/mobile/src/components/ConnectivityBanner.tsx");
const design = read("packages/design-tokens/src/index.ts");
const localization = read("packages/localization/src/index.ts");
const envExample = read(".env.example");
const backup = read("scripts/backup-postgres.ps1");
const restore = read("scripts/restore-postgres.ps1");
const gitignore = read(".gitignore");

for (const marker of [
  '"version": "1.0.0"',
  '"package": "com.leaguekick.app"',
  '"versionCode": 1',
  '"icon": "./assets/icon.png"',
  '"foregroundImage": "./assets/adaptive-icon.png"',
]) requireText(appConfig, marker, "Android release configuration missing");

for (const marker of [
  '"preview"',
  '"buildType": "apk"',
  '"production"',
  '"buildType": "app-bundle"',
  '"autoIncrement": true',
]) requireText(eas, marker, "EAS release profile missing");

for (const asset of [
  "apps/mobile/assets/icon.png",
  "apps/mobile/assets/adaptive-icon.png",
  "apps/mobile/assets/store/feature-graphic.png",
]) {
  const url = requireFile(asset, "Release asset missing");
  if (statSync(url).size < 1000) throw new Error(`Release asset looks invalid or empty: ${asset}`);
}

for (const marker of [
  'NODE_ENV !== "production"',
  'CORS_ORIGIN.trim() === "*"',
  "Production CORS origins must be valid HTTPS URLs.",
  "at least 48 characters",
]) requireText(runtime, marker, "Production environment guard missing");

for (const marker of [
  '"X-Request-Id"',
  'app.get("/health"',
  'app.get("/ready"',
  '"Cache-Control", "no-store"',
  'event: "http_request"',
  "normalizePath(request.path)",
]) requireText(apiApp, marker, "API release hardening missing");

for (const marker of [
  'await pool.query("select 1")',
  "server.requestTimeout = 30_000",
  "server.headersTimeout = 15_000",
  "server.closeAllConnections()",
]) requireText(server, marker, "API runtime lifecycle hardening missing");

for (const marker of [
  "const maxAttempts = safeRead ? 2 : 1",
  'method === "GET" || method === "HEAD"',
  "RETRYABLE_HTTP_STATUSES",
  'timedOut ? "TIMEOUT" : "NETWORK_ERROR"',
  "systemApi",
]) requireText(mobileApi, marker, "Mobile resilience invariant missing");
requireText(auth, "error.isNetworkError", "Offline/timeout auth preservation missing");

requireText(root, "<AppCrashBoundary>", "Safe crash boundary not wired");
for (const marker of [
  "systemApi.health()",
  "support.accountSupportId",
  "support.requestId",
]) requireText(support, marker, "Support diagnostics invariant missing");
requireText(settings, 'router.push("/support")', "Support navigation missing");

requireText(design, "touchTarget = 50", "Minimum touch target must remain at least 48dp");
requireText(button, "accessibilityLabel={label}", "Button accessibility label missing");
requireText(field, "accessibilityHint={error ?? hint}", "Form accessibility hint missing");
requireText(field, 'accessibilityLiveRegion="polite"', "Form error announcement missing");
requireText(text, "allowFontScaling={props.allowFontScaling ?? true}", "Dynamic text scaling missing");
requireText(network, 'accessibilityLiveRegion="assertive"', "Connectivity announcement missing");

for (const marker of [
  '"support.title"',
  '"support.requestId"',
  '"crash.title"',
]) {
  const count = localization.split(marker).length - 1;
  if (count !== 3) throw new Error(`Phase 8 localization must define ${marker} in all 3 languages; found ${count}.`);
}

for (const path of [
  "docs/OPERATIONS-RUNBOOK.md",
  "docs/ANDROID-RELEASE.md",
  "docs/PRIVACY-POLICY.md",
  "docs/store/PLAY-STORE-LISTING.md",
  "docs/PHASE-08-TEST-PLAN.md",
  "scripts/backup-postgres.ps1",
  "scripts/restore-postgres.ps1",
]) requireFile(path, "Phase 8 operational artifact missing");

requireText(backup, "pg_dump", "Backup command missing");
requireText(backup, "--format=custom", "Custom-format backup missing");
requireText(restore, "RESTORE_DATABASE_URL", "Explicit restore target missing");
requireText(restore, "-not $ConfirmRestore", "Restore confirmation guard missing");
requireText(restore, "--exit-on-error", "Restore fail-fast guard missing");
requireText(gitignore, "artifacts/backups/", "Database backups must be ignored by Git");

requireText(envExample, "sslmode=verify-full", "TLS verification example missing");
requireText(envExample, "ACCESS_TOKEN_SECRET=replace-with-", "Environment example must use a placeholder rather than a real secret");

console.log("Phase 8 release readiness verified: Android release profiles/assets, production config guards, request correlation/readiness, safe read retries, crash/support UX, accessibility, localization, and operations/backup procedures are present.");
