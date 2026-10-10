import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function requireText(content, marker, message) {
  if (!content.includes(marker)) throw new Error(`${message}: ${marker}`);
}
function rejectText(content, marker, message) {
  if (content.includes(marker)) throw new Error(`${message}: ${marker}`);
}

const contracts = read("packages/contracts/src/index.ts");
const authTypes = read("apps/api/src/modules/auth/auth.types.ts");
const authRepo = read("apps/api/src/modules/auth/auth.repository.ts");
const authService = read("apps/api/src/modules/auth/auth.service.ts");
const authRoutes = read("apps/api/src/modules/auth/auth.routes.ts");
const bookingRoutes = read("apps/api/src/modules/booking/booking.routes.ts");
const teamService = read("apps/api/src/modules/team/team.service.ts");
const ownerRoutes = read("apps/api/src/modules/owner/owner.routes.ts");
const competitionService = read("apps/api/src/modules/competition/competition.service.ts");
const databaseSchema = read("packages/database/src/schema.ts");
const paidRoleMigration = read("packages/database/drizzle/0010_paid_role_subscriptions.sql");
const register = read("apps/mobile/app/(auth)/register.tsx");
const login = read("apps/mobile/app/(auth)/login.tsx");
const forgotPassword = read("apps/mobile/app/(auth)/forgot-password.tsx");
const resetPassword = read("apps/mobile/app/(auth)/reset-password.tsx");
const settings = read("apps/mobile/app/(app)/(tabs)/settings.tsx");
const tabs = read("apps/mobile/app/(app)/(tabs)/_layout.tsx");
const paidRolePage = read("apps/mobile/app/(app)/role-subscriptions/[role].tsx");
const refereePage = read("apps/mobile/app/(app)/owner/referees.tsx");
const localization = read("packages/localization/src/index.ts");
const spec = read("docs/PRODUCT-SPEC.md");

for (const marker of [
  ".max(12)",
  "username: usernameSchema",
  "phone: phoneInputSchema",
  "password: newPasswordSchema",
  "confirmPassword: newPasswordSchema",
  "Passwords do not match.",
  '.regex(/\\p{L}/u, "Password must include at least one letter.")',
  '.regex(/\\p{N}/u, "Password must include at least one number.")',
]) requireText(contracts, marker, "Auth identity contract invariant missing");

requireText(contracts, 'z.enum(["VENUE_OWNER", "TEAM_MANAGER"])', "Only the two paid management roles may be self-service subscription choices");
rejectText(contracts, 'z.enum(["PLAYER", "VENUE_OWNER", "TEAM_MANAGER", "REFEREE"])', "Player and Referee must not be self-assignable");

for (const marker of [
  '"role_subscriptions"',
  '"venue_referees"',
  'paidRoleSubscriptionStatusEnum',
]) requireText(databaseSchema, marker, "Paid/scoped role database invariant missing");

for (const marker of [
  'CREATE TABLE IF NOT EXISTS "role_subscriptions"',
  'CREATE TABLE IF NOT EXISTS "venue_referees"',
  "1000",
  "300",
]) requireText(paidRoleMigration, marker, "Paid role migration invariant missing");

requireText(authRepo, "roles: []", "New users must start without management roles");
for (const marker of [
  "getRoleSubscriptionOffers",
  "requestRoleSubscription",
  "activateRoleSubscription",
  '(role!=="VENUE_OWNER"&&role!=="TEAM_MANAGER")||activePaid.has(role)',
]) requireText(authRepo, marker, "Paid role persistence/expiry invariant missing");

for (const marker of [
  "VENUE_OWNER: 1000",
  "TEAM_MANAGER: 300",
  "async roleSubscriptions",
  "async requestRoleSubscription",
  "async activatePaidRoleSubscription",
]) requireText(authService, marker, "Paid role service invariant missing");
rejectText(authService, "async activateSelfRole", "Free self-role activation must remain removed");

for (const marker of [
  'router.get("/role-subscriptions"',
  'router.post("/role-subscriptions/:role/request"',
  'router.post("/role-subscriptions/:userId/:role/activate"',
  'requireRole("PLATFORM_ADMIN")',
]) requireText(authRoutes, marker, "Paid role API invariant missing");
rejectText(authRoutes, 'router.post("/roles/activate"', "Legacy free role activation route must remain removed");

requireText(bookingRoutes, "router.use(requireAuth(tokens));", "All authenticated users must be able to use player booking routes");
rejectText(bookingRoutes, 'requireRole("PLAYER")', "Booking must not require a separately activated Player role");

for (const marker of [
  'return this.identity(userId);',
  'user.roles.includes("TEAM_MANAGER")',
  '"TEAM_OWNER_SUBSCRIPTION_REQUIRED"',
  '"No active account matches that username or phone number."',
]) requireText(teamService, marker, "Free-player / paid-Team-Owner invariant missing");
rejectText(teamService, "PLAYER_ACCOUNT_REQUIRED", "Base users must participate as players without a global Player role");

for (const marker of [
  'router.get("/referees"',
  'router.post("/referees"',
  'router.delete("/referees/:userId"',
]) requireText(ownerRoutes, marker, "Venue referee grant workflow missing");
requireText(competitionService, '"VENUE_REFEREE_REQUIRED"', "Competition scheduling must enforce venue-scoped referee grants");

for (const marker of [
  '{role:"VENUE_OWNER"',
  '{role:"TEAM_MANAGER"',
  'price:1000',
  'price:300',
  '"/role-subscriptions/venue-owner"',
  '"/role-subscriptions/team-owner"',
]) requireText(settings, marker, "Profile paid role choices missing");
rejectText(settings, '{role:"PLAYER"', "Profile must not offer Player self-activation");
rejectText(settings, '{role:"REFEREE"', "Profile must not offer Referee self-activation");
rejectText(settings, "activateRole(", "Profile must not directly activate management roles");

for (const marker of [
  'authApi.requestRoleSubscription',
  '"roles.venueCapabilityReferees"',
  '"roles.teamCapabilityPlayers"',
  'paymentReference',
]) requireText(paidRolePage, marker, "Paid role capability/payment page invariant missing");
for (const marker of [
  "ownerApi.grantReferee",
  "ownerApi.removeReferee",
]) requireText(refereePage, marker, "Venue referee management UI invariant missing");

requireText(tabs, 'name="bookings" options={{title:', "My Bookings must remain available to base accounts");
rejectText(tabs, "!player", "Tab visibility must not depend on a global Player role");

for (const marker of [
  'label={t("auth.username")}',
  'label={t("auth.phone")}',
  'label={t("auth.password")}',
  'label={t("auth.confirmPassword")}',
]) requireText(register, marker, "Signup fields invariant missing");
for (const marker of [
  'setFormError(t("auth.invalidCredentials"))',
  'router.push("/forgot-password")',
]) requireText(login, marker, "Login invariant missing");
for (const marker of [
  "authApi.requestPasswordReset",
  "authApi.verifyPasswordReset",
  '"PASSWORD_RESET_COOLDOWN"',
]) requireText(forgotPassword, marker, "Phone reset invariant missing");
for (const marker of [
  "authApi.completePasswordReset",
  "await signOut()",
  '"PASSWORD_RESET_COOLDOWN"',
]) requireText(resetPassword, marker, "Credential reset completion invariant missing");

for (const marker of [
  '"roles.venueOwner"',
  '"roles.teamOwner"',
  '"roles.venueCapabilityReferees"',
  '"roles.teamCapabilityPlayers"',
  '"roles.paidRoleRequests"',
  '"competition.referee"',
]) {
  const count = localization.split(marker).length - 1;
  if (count !== 3) throw new Error(`Role localization must define ${marker} in all 3 languages; found ${count}.`);
}

for (const marker of [
  "normal authenticated account",
  "Venue Owner",
  "1000 AFN",
  "Team Owner",
  "300 AFN",
  "venue-scoped Referee",
  "team-scoped Player",
]) requireText(spec, marker, "Product specification paid/scoped role model missing");

console.log("Auth/role model verified: base accounts book and participate for free; Venue Owner and Team Owner are payment-gated at 1000/300 AFN monthly; Player and Referee are scoped grants, not self-service global roles.");
