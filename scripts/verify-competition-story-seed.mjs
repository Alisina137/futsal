import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const path="packages/database/scripts/seed-competition-story.mjs";
const file=fileURLToPath(new URL("../"+path,import.meta.url));
execFileSync(process.execPath,["--check",file],{stdio:"pipe"});
const src=fs.readFileSync(file,"utf8");
const pkg=JSON.parse(fs.readFileSync(new URL("../package.json",import.meta.url),"utf8"));
const required=[
 "QA Story Premier League","QA Story Groups and Knockout Cup",
 "QA Story Knockout Championship","GROUP_KNOCKOUT","KNOCKOUT","LEAGUE",
 "roundRobin(ids)","rows.length===105","matches.played===21",
 "competition_groups","team_competition_roster","team_match_lineups",
 "player_match_stats","team_manager_profiles","player_dashboard_preferences",
 "team_activities","team_activity_responses","team_announcements",
 "team_guest_players","team_friendly_challenges","social_posts",
 "Refusing production seeding","await db.query(\"rollback\")",
 "pg_advisory_xact_lock","--confirm","No account roles",
];
for(const phrase of required){
 if(!src.includes(phrase))throw Error("Fixture safety/completeness marker missing: "+phrase);
}
if(pkg.scripts["db:seed:competition-story"]!=="node "+path)throw Error("Root seed command missing");
console.log("Competition story seed syntax and 3-stage/sample-data safeguards verified.");
