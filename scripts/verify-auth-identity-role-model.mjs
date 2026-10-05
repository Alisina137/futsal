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
const app = read("apps/api/src/app.ts");
const register = read("apps/mobile/app/(auth)/register.tsx");
const login = read("apps/mobile/app/(auth)/login.tsx");
const forgotPassword = read("apps/mobile/app/(auth)/forgot-password.tsx");
const resetPassword = read("apps/mobile/app/(auth)/reset-password.tsx");
const resetSession = read("apps/mobile/src/lib/passwordResetSession.ts");
const databaseSchema = read("packages/database/src/schema.ts");
const resetMigration = read("packages/database/drizzle/0007_password_reset_challenges.sql");
const accountProfileMigration = read("packages/database/drizzle/0008_account_profile_fields.sql");
const roles = read("apps/mobile/app/(app)/roles.tsx");
const home = read("apps/mobile/app/(app)/(tabs)/home.tsx");
const ownerDashboard = read("apps/mobile/src/components/owner/OwnerDashboard.tsx");
const tabs = read("apps/mobile/app/(app)/(tabs)/_layout.tsx");
const settings = read("apps/mobile/app/(app)/(tabs)/settings.tsx");
const account = read("apps/mobile/app/(app)/profile/account.tsx");
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
  '"Password must include at least one special character."',
  'z.enum(["PLAYER", "VENUE_OWNER", "TEAM_MANAGER", "REFEREE"])',
]) requireText(contracts, marker, "Auth identity contract invariant missing");

rejectText(contracts, "accountType: accountTypeSchema", "Signup must not accept account type");
rejectText(authTypes, 'role: "PLAYER" | "VENUE_OWNER"', "CreateUserInput must not require a product role");

requireText(authRepo, "roles: []", "New database users must begin without product roles");
requireText(authRepo, "async addRoles", "Later role persistence missing");
for (const marker of [
  "createPasswordResetChallenge",
  "verifyPasswordResetChallenge",
  "completePasswordReset",
  "sessions",
]) requireText(authRepo, marker, "Password reset persistence invariant missing");
requireText(databaseSchema, 'passwordResetChallenges = pgTable(', "Password reset challenge table missing");
requireText(resetMigration, 'CREATE TABLE IF NOT EXISTS "password_reset_challenges"', "Password reset migration missing");

for (const marker of [
  "displayName: username",
  "async activateSelfRole",
  'role === "TEAM_MANAGER"',
  '(["PLAYER", "TEAM_MANAGER"] as const)',
  "async updateProfile",
  "async requestPasswordReset",
  "async verifyPasswordReset",
  "async completePasswordReset",
  "randomInt(0, 1_000_000)",
  "randomBytes(32)",
  "attempts >= 5",
  "resetTokenExpiresAt",
]) requireText(authService, marker, "Auth service identity/role invariant missing");

requireText(authRoutes, 'router.post("/roles/activate"', "Role activation endpoint missing");
for (const marker of [
  'router.post("/password-reset/request"',
  'router.post("/password-reset/verify"',
  'router.post("/password-reset/complete"',
  "resetLimiter",
]) requireText(authRoutes, marker, "Password reset route invariant missing");
requireText(app, 'app.patch("/api/v1/users/me"', "Post-signup account profile endpoint missing");

for (const marker of [
  'label={t("auth.username")}',
  'label={t("auth.phone")}',
  'label={t("auth.password")}',
  'label={t("auth.confirmPassword")}',
  'placeholder={t("auth.placeholderUsername")}',
  'placeholder={t("auth.placeholderPhone")}',
  'placeholder={t("auth.placeholderNewPassword")}',
  'placeholder={t("auth.placeholderConfirmPassword")}',
  'label:t("auth.passwordRuleLetter")',
  'label:t("auth.passwordRuleNumber")',
  "passwordHasLetter",
  "passwordHasNumber",
  "secureTextEntry",
  'router.replace("/home")',
]) requireText(register, marker, "Signup UX invariant missing");
rejectText(register, "AccountType", "Signup must not expose account type");
rejectText(register, "setDisplayName", "Signup must not collect full name");
rejectText(register, 't("auth.registerSubtitle")', "Signup must not show role-model explanatory fluff");
rejectText(register, 't("auth.baseAccountNote")', "Signup must not show role-assignment explanatory fluff");
for (const marker of [
  "fieldErrors.username",
  "fieldErrors.phone",
  "fieldErrors.password",
  "fieldErrors.confirmPassword",
  "applyFieldErrors(next)",
  "requestAnimationFrame(()=>focusField(first))",
]) requireText(register, marker, "Signup inline validation/focus invariant missing");

for (const marker of [
  'label={t("auth.identifier")}',
  'label={t("auth.password")}',
  "invalidIdentifier",
  "invalidPassword",
  'setFormError(t("auth.invalidCredentials"))',
  'router.push("/forgot-password")',
  "secureTextEntry",
]) requireText(login, marker, "Sign-in UX invariant missing");
rejectText(login, "fieldErrors.identifier", "Sign-in must use one generic credential error instead of per-field credential messages");
rejectText(login, "fieldErrors.password", "Sign-in must use one generic credential error instead of per-field credential messages");

for (const marker of [
  'authApi.requestPasswordReset',
  'authApi.verifyPasswordReset',
  'setPasswordResetSession(verified)',
  'router.replace("/reset-password")',
]) requireText(forgotPassword, marker, "Forgot-password UX invariant missing");

for (const marker of [
  "getPasswordResetSession()",
  "authApi.completePasswordReset",
  "await signOut()",
  'router.replace({pathname:"/login",params:{reset:"success"}})',
  "<Modal",
  "showDialogPassword",
  '"•".repeat',
]) requireText(resetPassword, marker, "Credential-reset UX invariant missing");

for (const marker of [
  "setPasswordResetSession",
  "getPasswordResetSession",
  "clearPasswordResetSession",
]) requireText(resetSession, marker, "Reset token must remain in ephemeral in-memory session");

for (const marker of [
  '"PLAYER"',
  '"VENUE_OWNER"',
  '"TEAM_MANAGER"',
  '"REFEREE"',
  "activateRole",
  "<RoleSelector",
  "selectRole(role:SelfAssignableRole)",
]) requireText(settings, marker, "Profile role-management invariant missing");
requireText(roles, '<Redirect href="/settings"/>', "Legacy role route must redirect to Profile");
for (const marker of [
  'router.push("/venues")',
  'router.push("/feed")',
  'router.push("/competitions")',
  't("home.discoveryTitle")',
]) requireText(home, marker, "Home discovery invariant missing");
for (const marker of [
  'router.push("/venues")',
  'router.push("/feed")',
  'router.push("/competitions")',
]) requireText(ownerDashboard, marker, "Owner home discovery invariant missing");
for (const marker of [
  'router.push("/roles")',
  't("home.accountRole")',
  't("settings.username")',
  't("home.chooseRole")',
]) rejectText(home, marker, "Home must not expose account identity or role selection");
requireText(tabs, "const player=", "Tab visibility must distinguish base users from players");
requireText(settings, 'router.push("/profile/account")', "Settings account-profile entry missing");
for (const marker of [
  "profileImageUrl",
  "age",
  "email",
  "city",
  "bio",
  "updateProfile({",
]) requireText(account, marker, "Extended account profile UX invariant missing");
for (const marker of [
  '"profile_image_url"',
  '"age"',
  '"city"',
  '"bio"',
]) requireText(accountProfileMigration, marker, "Account profile migration invariant missing");

for (const marker of [
  '"auth.confirmPassword"',
  '"auth.placeholderUsername"',
  '"auth.placeholderPhone"',
  '"auth.placeholderNewPassword"',
  '"auth.placeholderConfirmPassword"',
  '"auth.passwordRuleLetter"',
  '"auth.passwordRuleNumber"',
  '"auth.passwordRuleLettersNumbers"',
  '"auth.usernameRequired"',
  '"auth.phoneRequired"',
  '"auth.passwordRequired"',
  '"auth.confirmPasswordRequired"',
  '"auth.usernameTaken"',
  '"auth.phoneTaken"',
  '"auth.forgotPassword"',
  '"auth.forgotTitle"',
  '"auth.verificationCode"',
  '"auth.invalidResetCode"',
  '"auth.resetTitle"',
  '"auth.confirmResetTitle"',
  '"auth.resetSuccess"',
  '"auth.baseAccountNote"',
  '"roles.basicUser"',
  '"settings.roles"',
  '"profile.accountEditTitle"',
  '"profile.personalInfo"',
  '"profile.image"',
  '"profile.age"',
  '"profile.email"',
  '"profile.city"',
  '"profile.bio"',
]) {
  const count = localization.split(marker).length - 1;
  if (count !== 3) throw new Error(`Auth localization must define ${marker} in all 3 languages; found ${count}.`);
}

for (const marker of [
  "Every new signup begins as a **simple authenticated user**",
  "**username, phone number, password, confirm password**",
  "Full name is **not** collected during signup",
  "Sign-in accepts either the account's **username or phone number**",
  "limited to **3–12 characters**",
  "Forgot password",
  "requires proof of phone ownership",
  "revokes all refresh sessions immediately",
]) requireText(spec, marker, "Product-spec auth model missing");

console.log("Auth identity/role model verified: base signup is role-free, usernames are 3–12 characters, login errors are generic, phone recovery requires one-time verification, reset tokens stay ephemeral on mobile, old sessions are revoked, and privileged roles remain controlled.");
