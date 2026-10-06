import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const launcher = readFileSync("scripts/dev-admin.mjs", "utf8");
const index = readFileSync("apps/mobile/app/index.tsx", "utf8");
const login = readFileSync("apps/mobile/app/(auth)/login.tsx", "utf8");
const admin = readFileSync("apps/mobile/app/(app)/admin/index.tsx", "utf8");
const protectedLayout = readFileSync("apps/mobile/app/(app)/_layout.tsx", "utf8");
const authLayout = readFileSync("apps/mobile/app/(auth)/_layout.tsx", "utf8");
const authStorage = readFileSync("apps/mobile/src/lib/auth-storage.ts", "utf8");

assert(packageJson.scripts?.["dev:admin"] === "node scripts/dev-admin.mjs", "dev:admin script is missing or changed.");
assert(launcher.includes('EXPO_PUBLIC_ADMIN_MODE: "true"'), "Admin launcher must enable admin mode.");
assert(launcher.includes('EXPO_PUBLIC_API_URL: adminApiUrl'), "Admin launcher must override the mobile/tunnel API URL.");
assert(launcher.includes('http://localhost:'), "Admin launcher must default to the local API.");
assert(launcher.includes('"--web"'), "Admin launcher must start the Expo web target.");
assert(launcher.includes('"8082"'), "Admin launcher must default to the dedicated admin port 8082.");
assert(index.includes('process.env.EXPO_PUBLIC_ADMIN_MODE === "true"'), "Root route must recognize admin mode.");
assert(index.includes('"/admin"'), "Root route must redirect admin mode to /admin.");
assert(login.includes('router.replace(adminPortal?"/admin":"/home")'), "Login must return admin mode to /admin.");
assert(login.includes('params.next==="/admin"||process.env.EXPO_PUBLIC_ADMIN_MODE==="true"'), "Admin login must remain in admin mode even after auth routing.");
assert(protectedLayout.includes('params: { next: "/admin" }'), "Protected admin routes must preserve /admin when redirecting to login.");
assert(authLayout.includes('adminMode ? "/admin" : "/home"'), "Authenticated admin mode must redirect to /admin.");
assert(authStorage.includes('Platform.OS !== "web"'), "Auth storage must have a browser-specific persistence path.");
assert(authStorage.includes('localStorage'), "Admin web sessions must persist in browser storage.");
assert(admin.includes('roles.includes("PLATFORM_ADMIN")'), "Admin screen must remain PLATFORM_ADMIN-gated.");
assert(admin.includes('const adminNavItems'), "Admin screen must provide dedicated management navigation.");
assert(admin.includes('function AdminSidebar'), "Admin screen must provide a dedicated admin sidebar.");
assert(admin.includes('maxWidth: 1500'), "Admin workspace must use a desktop-width management layout.");
assert(admin.includes('const loadPart = async <T,>'), "Admin datasets must load independently so one failed endpoint cannot blank the console.");
assert(admin.includes('loadIssues.join(" · ")'), "Admin console must expose endpoint-specific loading diagnostics.");

console.log("Admin web verified: dedicated launcher, persistent browser session, admin-safe routing, desktop management shell, and PLATFORM_ADMIN gate.");
