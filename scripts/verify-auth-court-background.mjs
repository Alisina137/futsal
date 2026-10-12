import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const hero=read("apps/mobile/src/components/auth/AuthHero.tsx");
const login=read("apps/mobile/app/(auth)/login.tsx");
const register=read("apps/mobile/app/(auth)/register.tsx");
const file=new URL("../apps/mobile/assets/auth-futsal-court.jpg",import.meta.url);
assert.ok(statSync(file).size>4_000,"Bundled user-provided image asset must exist.");
assert.ok(hero.includes('source={require("../../../assets/auth-futsal-court.jpg")}'),
  "AuthHero must render the local user-provided court photo, not a URL or blank color.");
assert.ok(hero.includes('return <ImageBackground')&&hero.includes('resizeMode="cover"')&&
  hero.includes("styles.photoScrim")&&hero.includes('testID="auth-court-background"'),
  "Photo-backed hero must cover its frame with a text-legibility overlay.");
assert.ok(!hero.includes("pitchLineOuter")&&!hero.includes("pitchLineCenter")&&
  !hero.includes("pitchCircle"),
  "Old decorative dark banner must be replaced, not layered above the photo.");
assert.ok(login.includes("<AuthHero/>")&&register.includes("<AuthHero/>"),
  "Login and Signup must share the same image header above their input cards.");
assert.ok(register.indexOf("<AuthHero/>")<register.indexOf("<Card style={styles.formCard}>")&&
  login.indexOf("<AuthHero/>")<login.indexOf("<Card style={styles.formCard}>"),
  "Both auth forms must render the banner before input fields.");
console.log("Auth court background verified: local supplied image displayed with readable overlay on both Sign In and Sign Up.");
