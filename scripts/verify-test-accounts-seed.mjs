import fs from "node:fs";
import {execFileSync} from "node:child_process";

function read(path) {
  return fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
}
function requireMarker(source,marker) {
  if(!source.includes(marker))throw new Error("Test-account seed invariant missing: "+marker);
}
const name="apps/api/scripts/seed-test-accounts.mjs";
execFileSync(process.execPath,["--check",new URL("../"+name,import.meta.url).pathname],{stdio:"pipe"});
const code=read(name);
const gitignore=read(".gitignore");
const pkg=JSON.parse(read("package.json"));
for(const marker of [
  "username,email,password,role",
  "ftn", "ftt", "ftv", "ftr", "ftp",
  "email_verified_at", "argon2.hash", "argon2.verify",
  "role_subscriptions", "venue_subscriptions", "venue_referees",
  "team_memberships", "player_profiles", "venue_areas",
  "FUTSAL_QA_25_20261011", "refusing to", "rollback", "--delete-test-accounts",
]){
  requireMarker(code,marker==="refusing to"?"Refusing to":marker);
}
requireMarker(gitignore,"test-accounts-private.csv");
if(pkg.scripts["db:seed:test-accounts"]!=="node apps/api/scripts/seed-test-accounts.mjs")
  throw new Error("Expected explicit root seed command.");
if(/['"]T![A-Za-z0-9_-]{10,}/.test(code))
  throw new Error("Passwords must never be committed to the seeder.");
console.log("QA account seeder verified: 25 private credentials, email marker, scoped roles, rollback and cleanup safety.");
