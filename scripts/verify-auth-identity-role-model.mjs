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
const roles = read("apps/mobile/app/(app)/roles.tsx");
const home = read("apps/mobile/app/(app)/(tabs)/home.tsx");
const tabs = read("apps/mobile/app/(app)/(tabs)/_layout.tsx");
const settings = read("apps/mobile/app/(app)/(tabs)/settings.tsx");
const account = read("apps/mobile/app/(app)/profile/account.tsx");
const localization = read("packages/localization/src/index.ts");
const spec = read("docs/PRODUCT-SPEC.md");

for (const marker of [
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
  "displayName: username",
  "async activateSelfRole",
  'role === "TEAM_MANAGER"',
  '(["PLAYER", "TEAM_MANAGER"] as const)',
  "async updateProfile",
]) requireText(authService, marker, "Auth service identity/role invariant missing");

requireText(authRoutes, 'router.post("/roles/activate"', "Role activation endpoint missing");
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
  "fieldErrors.identifier",
  "fieldErrors.password",
  "applyFieldErrors(next)",
  "requestAnimationFrame(()=>focusField(first))",
  "secureTextEntry",
]) requireText(login, marker, "Sign-in UX invariant missing");

for (const marker of [
  '"PLAYER"',
  '"VENUE_OWNER"',
  '"TEAM_MANAGER"',
  '"REFEREE"',
  "activateRole",
]) requireText(roles, marker, "Role center invariant missing");

requireText(home, "return <BaseUserHome", "Role-free users need neutral home");
requireText(tabs, "const player=", "Tab visibility must distinguish base users from players");
requireText(settings, 'router.push("/roles")', "Settings role management entry missing");
requireText(settings, 'router.push("/profile/account")', "Settings account-profile entry missing");
requireText(account, "updateProfile({displayName:value})", "Later full-name editing missing");

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
  '"auth.baseAccountNote"',
  '"roles.basicUser"',
  '"settings.roles"',
  '"profile.accountEditTitle"',
]) {
  const count = localization.split(marker).length - 1;
  if (count !== 3) throw new Error(`Auth localization must define ${marker} in all 3 languages; found ${count}.`);
}

for (const marker of [
  "Every new signup begins as a **simple authenticated user**",
  "**username, phone number, password, confirm password**",
  "Full name is **not** collected during signup",
  "Sign-in accepts either the account's **username or phone number**",
]) requireText(spec, marker, "Product-spec auth model missing");

console.log("Auth identity/role model verified: base signup is role-free, username/phone credentials are authoritative, full name is configured later, role activation is explicit, and privileged roles remain controlled.");
