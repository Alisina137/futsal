import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function assert(value, message) {
  if (!value) throw new Error(message);
}

const seed = read("packages/database/scripts/seed-role-demos.mjs");
const root = JSON.parse(read("package.json"));
const dbPackage = JSON.parse(read("packages/database/package.json"));

for (const username of ["shams","abdul","mahdi","alisina","saeed","ali"]) {
  assert(seed.includes(`["${username}"`), `Role demo user missing: ${username}`);
}

assert(seed.includes('normalizeRole(users.shams.id, null)'), "Shams must remain a base Normal User without a privileged role.");
assert(seed.includes('normalizeRole(users.abdul.id, "PLAYER")'), "Abdul must receive PLAYER.");
assert(seed.includes('normalizeRole(users.mahdi.id, "VENUE_OWNER")'), "Mahdi must receive VENUE_OWNER.");
assert(seed.includes('normalizeRole(users.alisina.id, "TEAM_MANAGER")'), "Alisina must receive TEAM_MANAGER.");
assert(seed.includes('normalizeRole(users.saeed.id, "REFEREE")'), "Saeed must receive REFEREE.");
assert(seed.includes('normalizeRole(users.ali.id, "PLATFORM_ADMIN")'), "Ali must receive PLATFORM_ADMIN.");

assert(seed.includes('monthlyPriceAfn: 1000') && seed.includes('role: "VENUE_OWNER"'), "Mahdi paid Venue Owner demo entitlement missing.");
assert(seed.includes('monthlyPriceAfn: 300') && seed.includes('role: "TEAM_MANAGER"'), "Alisina paid Team Owner demo entitlement missing.");
assert(seed.includes("venue_referees") && seed.includes("users.saeed.id"), "Saeed venue-scoped referee assignment missing.");
const abdulMembershipAnchor = seed.indexOf("[team.id, users.abdul.id]");
assert(abdulMembershipAnchor >= 0, "Abdul team membership seed parameters missing.");
const abdulMembershipBlock = seed.slice(Math.max(0, abdulMembershipAnchor - 1_000), abdulMembershipAnchor + 120);
assert(
  abdulMembershipBlock.includes("team_memberships")
    && abdulMembershipBlock.includes("'PLAYER', 7")
    && abdulMembershipBlock.includes("status = 'ACTIVE'"),
  "Abdul team-scoped Player membership missing.",
);
assert(seed.includes("social_follows") && seed.includes('["VENUE", venue.id]') && seed.includes('["TEAM", team.id]') && seed.includes('["COMPETITION", competition.id]'), "Shams mixed Home feed follows missing.");
assert(seed.includes("role-demo-shams-booking"), "Shams sample booking missing.");
assert(seed.includes("LeagueKick Demo Cup"), "Demo competition missing.");
assert(seed.includes("ROLE_DEMO_SEEDED"), "Admin audit demo data missing.");

assert(root.scripts["db:seed:roles"] === "pnpm --dir packages/database run db:seed:roles", "Root db:seed:roles command missing.");
assert(dbPackage.scripts["db:seed:roles"] === "node scripts/seed-role-demos.mjs", "Database db:seed:roles command missing.");

console.log("Six-role demo seed verified: shams Normal User, abdul Player, mahdi Venue Owner, alisina Team Owner, Saeed Referee, ali Platform Admin.");
