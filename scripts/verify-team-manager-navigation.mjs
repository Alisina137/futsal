import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const expect=(condition,message)=>{if(!condition)throw Error(message);};
const dash=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const locale=read("packages/localization/src/index.ts");
const main=dash.slice(dash.indexOf("const mainTabs=["),dash.indexOf("const aboutTeamTabs=["));
const sub=dash.slice(dash.indexOf("const aboutTeamTabs=["),dash.indexOf("function isAboutTeamSection"));
for(const id of ["overview","aboutTeam","media","statistics","settings"])
  expect(main.includes('id:"'+id+'"'),"Missing main tab "+id);
for(const id of ["players","competitions","matches","schedule"])
  expect(sub.includes('id:"'+id+'"'),"Missing About Team subtab "+id);
expect(main.includes('key:"tmnav.analytics"')&&sub.includes('key:"tmnav.program"'),
  "Analytics must reuse Statistics and Program must reuse Schedule.");
expect(dash.includes('section==="aboutTeam"?lastAboutTeamTab:section'),
  "The About Team tab must restore the previous subtab.");
expect(dash.includes('{activeMain==="aboutTeam"?<ScrollView'),
  "The submenu should only be visible when About Team is selected.");
expect(dash.includes('focusTab(activeMain)')&&dash.includes('focusSubTab(tab)'),
  "Both navigation rows must center their selected tab.");
expect(dash.includes('navRef.current?.scrollTo')&&dash.includes('subNavRef.current?.scrollTo'),
  "Both tab rows must be horizontally scrollable.");
expect(dash.includes('accessibilityState={{selected:activeMain===item.id}}')&&
  dash.includes('accessibilityState={{selected:tab===item.id}}'),
  "Both rows need accessible selected tabs.");
expect(dash.includes('navActive:{borderBottomColor:colors.primary')&&
  dash.includes('subActive:{borderBottomColor:colors.primary'),
  "Both rows need a blue active indicator.");
for(const key of ["overall","aboutTeam","media","analytics","settings","team",
  "players","competitions","matches","program","mainNavigation","subNavigation"])
  expect(locale.split('"tmnav.'+key+'"').length-1===3,
    "Missing translation in three languages: "+key);
for(const key of ['tab==="overview"','tab==="players"',
  'tab==="competitions"','tab==="matches"','tab==="schedule"',
  'tab==="media"','tab==="statistics"','tab==="settings"'])
  expect(dash.includes(key),"Existing section no longer reachable: "+key);
expect(!sub.includes('id:"team"'),"Team creation/editing must be removed from About Team navigation.");
expect(dash.includes('tab==="settings"')&&dash.includes('t("tm1.teamIdentity")'),
  "All team base information must be editable inside Settings.");
console.log("Team Manager navigation verified: four About Team subtabs; team identity inside Settings.");
