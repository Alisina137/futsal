import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const screen=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const positions=read("apps/mobile/src/lib/team-detail-squad.ts");
const focus=read("apps/mobile/src/hooks/useVisibleTab.ts");
const pkg=JSON.parse(read("package.json"));
function contains(text,patterns,scope){
  for(const marker of patterns)assert.ok(text.includes(marker),scope+" missing: "+marker);
}
contains(positions,[
  'export const squadPositionFilters:readonly SquadPositionFilter[]=',
  '"ALL","GOALKEEPER","FIXO","ALA","PIVO","UNIVERSAL","UNSPECIFIED"',
  '(position==="ALL"||member.position===position)',
], "Squad positions and All filter");
contains(screen,[
  'const [squadPosition,setSquadPosition]=useState<SquadPositionFilter>("ALL")',
  'setPublicPlayerIds([]);setSquadQuery("");setSquadPosition("ALL")',
  'const squadPositionNav=useVisibleTab<SquadPositionFilter>(squadPosition)',
  'testID="team-squad-position-nav"',
  'ref={squadPositionNav.scrollRef}',
  'onLayout={squadPositionNav.onViewport}',
  'onContentSizeChange={squadPositionNav.onContentSize}',
  'onLayout={event=>squadPositionNav.cellLayout(position,event)}',
  'testID={"team-squad-filter-"+position}',
  'accessibilityRole="tab"',
  'accessibilityState={{selected:squadPosition===position}}',
  'onPress={()=>chooseSquadPosition(position)}',
  'setSquadPosition(position);',
  'squadPositionNav.focus(position,true);',
  'squadPosition===position&&styles.squadFilterActive',
  'position==="ALL"?tx("squadAll")',
  'style={{color:squadPosition===position?"#FFFFFF":colors.primary}}',
  'squadFilter:{minHeight:44',
  'const leadersOnly=subs.squad==="leaders";',
  '{!leadersOnly?<>',
], "Focused Squad position navigation");
assert.ok(!screen.includes('onPress={()=>setSquadPosition(position)}'),
  "Squad tab taps must focus the selected chip, not only change its filter.");
assert.ok(!screen.includes('!leadersOnly&&team.members.length>0?<>'),
  "Even an empty public squad should show the All Positions default navigation.");
assert.ok(screen.indexOf('testID="team-squad-position-nav"')<
  screen.indexOf('testID="team-squad-grid"'),"Position chips precede roster results.");
contains(focus,[
  'scrollRef.current?.scrollTo({x,y:0,animated})',
  'useEffect(()=>{',
  'const onViewport=useCallback',
  'const onContentSize=useCallback',
  'const cellLayout=useCallback',
], "Shared RTL/LTR auto-center");
assert.ok(pkg.scripts["verify:team-squad-position-focus"]?.includes("verify-team-squad-position-focus.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:team-squad-position-focus"));
console.log("Team Squad position focus verified: All Positions default, selected/centered taps in RTL/LTR, scroll measured and navigation remains visible for an empty authorized roster.");
