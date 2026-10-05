import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const launcher = readFileSync("scripts/dev-admin.mjs", "utf8");
const index = readFileSync("apps/mobile/app/index.tsx", "utf8");
const login = readFileSync("apps/mobile/app/(auth)/login.tsx", "utf8");
const admin = readFileSync("apps/mobile/app/(app)/admin/index.tsx", "utf8");

assert(packageJson.scripts?.["dev:admin"] === "node scripts/dev-admin.mjs", "dev:admin script is missing or changed.");
assert(launcher.includes('EXPO_PUBLIC_ADMIN_MODE: "true"'), "Admin launcher must enable admin mode.");
assert(launcher.includes('"--web"'), "Admin launcher must start the Expo web target.");
assert(launcher.includes('"8082"'), "Admin launcher must default to the dedicated admin port 8082.");
assert(index.includes('process.env.EXPO_PUBLIC_ADMIN_MODE === "true"'), "Root route must recognize admin mode.");
assert(index.includes('"/admin"'), "Root route must redirect admin mode to /admin.");
assert(login.includes('params.next==="/admin"?"/admin":"/home"'), "Login must return an admin launch to /admin.");
assert(admin.includes('roles.includes("PLATFORM_ADMIN")'), "Admin screen must remain PLATFORM_ADMIN-gated.");

console.log("Admin web launcher verified: dedicated command, admin-mode redirect, safe login return, and role gate.");
