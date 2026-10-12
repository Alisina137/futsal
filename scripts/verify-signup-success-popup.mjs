import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const signup=read("apps/mobile/app/(auth)/register.tsx");
const auth=read("apps/mobile/src/providers/AuthProvider.tsx");
const locales=read("packages/localization/src/index.ts");
const packageJson=JSON.parse(read("package.json"));

assert.ok(signup.includes("const SIGNUP_SUCCESS_DURATION_MS=3_000;"),
  "Signup success popup must last exactly 3000ms.");
assert.ok(signup.includes("const [registered,setRegistered]=useState(false);")&&
  signup.includes("useEffect(()=>{\n    if(!registered)return;"),
  "The popup must be triggered only after signup succeeds.");
const submit=signup.slice(signup.indexOf("async function submit()"),signup.indexOf("  return <Screen"));
assert.ok(submit.includes("await register({")&&
  submit.indexOf("await register({")<submit.indexOf("setRegistered(true);"),
  "Never show account-creation success before the backend confirms it.");
assert.ok(!submit.includes('router.replace("/login")'),
  "Successful signup must show a popup before navigating, rather than navigate immediately.");
assert.ok(signup.includes('setTimeout(()=>{\n      router.replace("/login");\n    },SIGNUP_SUCCESS_DURATION_MS)')&&
  signup.includes('SIGNUP_SUCCESS_DURATION_MS-SIGNUP_SUCCESS_FADE_OUT_MS'),
  "Only after three seconds should the user reach Sign In; exit animation must precede it.");
assert.ok(signup.includes("clearTimeout(fadeTimer);")&&
  signup.includes("clearTimeout(navigationTimer);")&&
  signup.includes("successOpacity.stopAnimation();"),
  "Timers and animation must be cleaned up on unmount.");
assert.ok(signup.includes('Modal visible={registered} transparent')&&
  signup.includes('testID="signup-success-popup"')&&
  signup.includes('accessibilityRole="alert"')&&
  signup.includes('colors.success')&&
  signup.includes('ActivityIndicator size="small"'),
  "Accessible, gently styled animated popup with success indication is required.");
assert.ok(signup.includes("if(registered||submissionRef.current)return;")&&
  signup.includes("disabled={busy||registered}")&&
  signup.includes('Pressable accessibilityRole="button" disabled={registered}'),
  "Duplicate submissions and manual redirects must be prevented during the popup.");
assert.ok(auth.includes("const register = useCallback(async (input: RegisterRequest) => authApi.register(input), []);"),
  "Signup must remain register-only; users sign in separately.");
for(const suffix of ["signupSuccessTitle","signupSuccessMessage","signupSuccessRedirect"])
  assert.equal(locales.split('"auth.'+suffix+'"').length-1,3,
    "Missing translated English/Dari/Pashto copy: "+suffix);
assert.ok(packageJson.scripts.verify.includes("pnpm verify:signup-success-popup"),
  "Signup success regression must run within the default verify pipeline.");
console.log("Signup confirmation verified: registration success only, gentle accessible 3-second popup, localized copy, timed fade and Sign In transition, cleanup and double-submit guard.");
