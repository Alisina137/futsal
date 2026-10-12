/**
 * Local-only troubleshooting for persistent "Internet connected, Futsal server
 * unavailable" warnings. Reads only hosts/URLs (never DB credentials).
 */
import process from "node:process";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mobileEnvFile, readMobileApiUrl } from "./mobile-api-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootEnv = path.join(root, ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const port = Number(process.env.API_PORT || "4000");
const local = "http://127.0.0.1:" + port;
function describeEndpoint(value) {
  try { const u = new URL(value); return u.origin; }
  catch { return "(invalid URL)"; }
}
async function health(origin, endpoint, timeoutMs=3500) {
  try {
    const res = await fetch(origin.replace(/\/$/, "") + endpoint, {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json().catch(() => null);
    return { good: res.ok && body?.service === "futsal-api" &&
      body?.status === (endpoint === "/ready" ? "ready" : "ok"),
      http: res.status, service: body?.service ?? null, status: body?.status ?? null };
  } catch (e) {
    return { good: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
async function ngrok() {
  try {
    const res = await fetch("http://127.0.0.1:4040/api/tunnels", {
      signal: AbortSignal.timeout(2400),
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const tunnel = (Array.isArray(payload.tunnels) ? payload.tunnels : []).find((v) =>
      v.public_url?.startsWith("https://") &&
      new RegExp("(^|:)" + port + "(/|$)").test(v.config?.addr || ""));
    return tunnel?.public_url ?? null;
  } catch { return null; }
}
console.log("[check:api] Checking Futsal API configuration (no secrets printed).");
const localHealth = await health(local, "/health");
const localReady = await health(local, "/ready");
console.log("[check:api] Local API /health: " + (localHealth.good ? "OK" : "FAILED") +
  " (" + describeEndpoint(local) + ")");
console.log("[check:api] Local PostgreSQL /ready: " + (localReady.good ? "OK" : "FAILED"));
if (!localHealth.good) {
  console.log("[check:api] Start pnpm dev:api and keep its terminal running.");
  console.log("[check:api] If startup fails, run pnpm --filter @leaguekick/api dev to see why.");
} else if (!localReady.good) {
  console.log("[check:api] The API is alive but the database is not ready; verify DATABASE_URL and Neon access.");
}
const tunnel = await ngrok();
console.log("[check:api] Current ngrok tunnel: " + (tunnel ?? "(none found on port 4040)"));
const file = mobileEnvFile(root);
const configured = readMobileApiUrl(file);
console.log("[check:api] Expo .env.local API: " + (configured ?? "(not set)"));
if (!existsSync(file)) {
  console.log("[check:api] apps/mobile/.env.local is missing; mobile may fall back to localhost:4000.");
}
const shellUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || null;
if (shellUrl && configured && shellUrl.replace(/\/$/,"") !== configured.replace(/\/$/,""))
  console.log("[check:api] WARNING: EXPO_PUBLIC_API_URL in the environment differs from apps/mobile/.env.local, and can override it.");
if (tunnel && configured && tunnel.replace(/\/$/,"") !== configured.replace(/\/$/,""))
  console.log("[check:api] STALE MOBILE URL: current ngrok and Expo .env.local differ. Restart pnpm dev:api to auto-sync.");
if (configured) {
  const remote = await health(configured, "/health", 5000);
  console.log("[check:api] Configured mobile API /health: " +
    (remote.good ? "OK" : "FAILED") + " (" + describeEndpoint(configured) + ")");
  if (!remote.good && localHealth.good) {
    console.log("[check:api] Your API runs locally but the phone/app targets an unreachable URL.");
    console.log("[check:api] Restart pnpm dev:api, verify the printed ngrok URL, then restart pnpm dev:mobile.");
  }
}
console.log("[check:api] After any EXPO_PUBLIC_API_URL change, stop Expo and run pnpm dev:mobile again, then reload the app.");
if (!localHealth.good || !localReady.good || (configured && !(await health(configured, "/health", 3000)).good))
  process.exitCode=1;
