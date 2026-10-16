import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("apps/mobile/src/components/social/CompetitionDirectoryExperience.tsx");
const select=read("apps/mobile/src/components/social/DirectoryFilterSelect.tsx");
const contract=read("packages/contracts/src/index.ts");
const pkg=JSON.parse(read("package.json"));

const gridStart=page.indexOf('<View testID="competitions-primary-filter-grid"');
const resultsStart=page.indexOf('testID="competitions-results-section"',gridStart);
assert.ok(gridStart>=0&&resultsStart>gridStart,"The primary 2x2 filter grid must precede competition results.");
const grid=page.slice(gridStart,resultsStart);
const first=grid.indexOf('testID="competitions-primary-filter-row-1"');
const second=grid.indexOf('testID="competitions-primary-filter-row-2"');
assert.ok(first>=0&&second>first,"Exactly two primary filter rows must be rendered.");
const row1=grid.slice(first,second),row2=grid.slice(second);
const selectors=part=>[...part.matchAll(/<DirectoryFilterSelect compact testID="competition-(\w+)-select"/g)]
  .map(match=>match[1]);
assert.deepEqual(selectors(row1),["province","status"],"First row must have province and status side by side.");
assert.deepEqual(selectors(row2),["format","fee"],"Second row must have format and fee side by side.");
assert.equal(selectors(grid).length,4,"Exactly four primary filter dropdowns should remain.");
assert.equal((grid.match(/<View style={styles.filterCell}>/g)??[]).length,4,
  "Both rows need two equal-width independent filter cells.");
for(const marker of [
  'style={[styles.filterRow,{flexDirection:isRTL?"row-reverse":"row"}]}',
  'filterGrid:{gap:spacing.sm,width:"100%"}',
  'filterRow:{gap:spacing.sm,width:"100%",alignItems:"stretch"}',
  'filterCell:{flex:1,minWidth:0}',
  'onSelect={pickProvince}', 'onSelect={pickStatus}',
  'onSelect={pickFormat}', 'onSelect={pickFee}',
  'setProvince(value);','province:value,city:""',
  'setQuery("");setProvince("");setStatus("");setFormat("");setFee("any");',
  'load(applied.current,currentPage+1,true)',
]){
  assert.ok(page.includes(marker),"Missing 2x2 filtering behavior: "+marker);
}
assert.ok(!page.includes('testID="competition-city-select"')&&
  !page.includes('function pickCity(')&&!page.includes('const [city,setCity]'),
  "Remove the city selector and its orphaned state, not just hide the control.");
assert.ok(page.includes('q:"",province:"",city:"",fee:"any"')&&
  contract.includes('city:z.string().trim().max(80).default("")'),
  "Keep an empty city in the required discovery DTO without offering a redundant city dropdown.");
for(const marker of [
  'compact?:boolean',
  'compact=false',
  'fieldCompact:{gap:spacing.xs,minWidth:0}',
  'selectCompact:{minHeight:46,paddingHorizontal:spacing.sm,gap:spacing.xs}',
  '!compact?<Ionicons name="location-outline"',
  'numberOfLines={1}',
  'accessibilityState={{expanded:open}}',
  'onSelect(option.value);setOpen(false)',
]){
  assert.ok(select.includes(marker),"Compact selection, accessibility or touch interaction missing: "+marker);
}
assert.ok(pkg.scripts["verify:competitions-filter-grid"]?.includes("verify-competitions-filter-grid.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:competitions-filter-grid"));
console.log("Competition discovery: province/status/format/fee in 2x2 RTL-aware compact selects; city filter removed, required empty city query preserved; search and server paging retained.");
