import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const screen=read("apps/mobile/app/(app)/profile/credentials.tsx");
const contracts=read("packages/contracts/src/index.ts");
const service=read("apps/api/src/modules/auth/auth.service.ts");
const repository=read("apps/api/src/modules/auth/auth.repository.ts");
const locales=read("packages/localization/src/index.ts");
const authTest=read("apps/api/test/auth.test.ts");
const packageJson=JSON.parse(read("package.json"));
for(const token of [
  'type Step="choose"|"verify"|"update"',
  'type ChangeKind="username"|"password"|"both"',
  'testID={"credentials-mode-"+option}',
  'accessibilityState={{checked:kind===option}}',
  'authApi.requestPasswordReset({identifier:email})',
  'authApi.verifyPasswordReset({requestId,code})',
  'if(result.email.toLowerCase()!==email?.toLowerCase())',
  'if(tokenExpiresAt&&Date.parse(tokenExpiresAt)<=Date.now())',
  'const waitSeconds=Math.max(0,Math.ceil((resendUntil-now)/1_000))',
  'isUsernameChange(kind)?{username:username.trim()}:{}',
  'isPasswordChange(kind)?{password,confirmPassword}:{}',
  'setFieldErrors(next)',
  'name={rule.met?"checkmark-circle":"ellipse-outline"}',
  'await signOut()',
  'router.replace({pathname:"/login",params:{reset:"success"}})',
  'Modal visible={confirming}',
  'formatLocalDateTime(availableAt,language)',
])assert.ok(screen.includes(token),"Credential UI missing: "+token);
assert.ok(contracts.includes("username: usernameSchema.optional()")&&
  contracts.includes("password: newPasswordSchema.optional()")&&
  contracts.includes("confirmPassword: newPasswordSchema.optional()")&&
  contracts.includes('message:"Choose a username or password to update."'),
  "Contract must accept username-only, password-only and both, and reject no change.");
assert.ok(service.includes('input.password?await argon2.hash(input.password):user.passwordHash')&&
  service.includes('if(!input.password && usernameNormalized===user.usernameNormalized)')&&
  service.includes("this.ensurePasswordResetCooldown(user)")&&
  service.includes("this.repository.completePasswordReset({"),
  "Verified email reset, 72-hour cooldown and session revocation must stay enforced.");
assert.ok(repository.includes("tx.update(passwordResetChallenges)")&&
  repository.includes("tx.update(sessions)")&&
  repository.includes("revokedAt: input.credentialResetAt"),
  "Credential changes must atomically consume the token and revoke sessions.");
for(const marker of [
  'changes username only without changing password, and revokes sessions',
  'changes password only without changing username or allowing reuse',
  'NO_CREDENTIAL_CHANGE',
  'newLogin.status).toBe(200)',
  'oldSession.status).toBe(401)',
])assert.ok(authTest.includes(marker),"Auth integration coverage missing: "+marker);
for(const key of ["security.credentialsChoose","security.credentialsChooseHelp","security.credentialsStep.choose","security.credentialsStep.verify","security.credentialsStep.update","security.credentialsMode.username","security.credentialsMode.password","security.credentialsMode.both","security.credentialsModeHelp.username","security.credentialsModeHelp.password","security.credentialsModeHelp.both","security.credentialsCurrentUsername","security.credentialsNewUsername","security.credentialsNewPassword","security.credentialsNoChange","security.credentialsResend","security.credentialsWait","security.credentialsReauthWarning","security.credentialsReview","security.credentialsPasswordHidden"])
assert.equal(locales.split('"'+key+'"').length-1,3,
  "Missing translated credentials text: "+key);
assert.ok(packageJson.scripts.verify.includes("pnpm verify:credentials"),
  "Credential regression script must run with normal verification.");
console.log("Credential UI/security source invariants verified: separate changes, verified email, token, cooldown, session revocation, and translation.");
