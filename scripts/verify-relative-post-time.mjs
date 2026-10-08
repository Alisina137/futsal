import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
function assert(value,message){if(!value)throw new Error(message);}

const source=read("apps/mobile/src/lib/date-time.ts");
const hook=read("apps/mobile/src/hooks/usePostTimeNow.ts");
const compiled=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const scope={exports:{},Intl,Date};
vm.runInNewContext(compiled,scope);
const {formatPostTimeAgo}=scope.exports;
assert(!source.includes("new Intl.RelativeTimeFormat"),"Android Hermes does not always implement Intl.RelativeTimeFormat.");
const safeScope={exports:{},Date,Intl:{DateTimeFormat:Intl.DateTimeFormat}};
vm.runInNewContext(compiled,safeScope);
assert(safeScope.exports.formatPostTimeAgo(new Date("2026-10-08T11:16:00Z"),"en",Date.parse("2026-10-08T12:00:00Z"))==="44 minutes ago",
  "Post timestamps must work without Intl.RelativeTimeFormat and NumberFormat on Android.");

assert(typeof formatPostTimeAgo==="function","Relative post formatter must exist.");
const now=Date.parse("2026-10-08T12:00:00.000Z");
const before=(ms)=>new Date(now-ms).toISOString();
const cases=[
  [44*60_000,"44 minutes ago"],
  [12*3_600_000,"12 hours ago"],
  [24*3_600_000,"1 day ago"],
  [7*24*3_600_000,"1 week ago"],
  [30*24*3_600_000,"1 month ago"],
  [365*24*3_600_000,"1 year ago"],
];
for(const [elapsed,expected] of cases){
  const actual=formatPostTimeAgo(before(elapsed),"en",now);
  assert(actual===expected,`Expected "${expected}" but got "${actual}".`);
}
assert(formatPostTimeAgo(before(5_000),"en",now)==="now","Posts under one minute must show now.");
assert(!formatPostTimeAgo(before(-60_000),"en",now).startsWith("in "),"Future timestamps must not display a future-relative label.");
for(const language of ["fa-AF","ps-AF"]){
  const result=safeScope.exports.formatPostTimeAgo(before(44*60_000),language,now);
  assert(result.length>3&&!result.includes("2026"),`Locale ${language} must display relative time, not a date.`);
}
assert(hook.includes("setInterval(")&&hook.includes("60_000")&&hook.includes('state==="active"'),"Relative labels must refresh every minute and on app foreground.");

const files=[
  "apps/mobile/app/(app)/(tabs)/home.tsx",
  "apps/mobile/app/(app)/owner/posts/index.tsx",
  "apps/mobile/app/(app)/venues/[venueId].tsx",
  "apps/mobile/app/(app)/posts/[postId].tsx",
];
for(const file of files){
  const page=read(file);
  assert(page.includes("formatPostTimeAgo("),`Post timestamp not relative: ${file}`);
  assert(page.includes("usePostTimeNow()"),`Post timestamp doesn't refresh: ${file}`);
}
assert(read(files[1]).includes("formatLocalDateTimeParts(schedule.executeAt"),"Scheduled actions must retain their precise execution date/time.");
console.log("Relative post timestamps verified: now, minutes, hours, days, weeks, months, years, locale support, refresh, all four post surfaces.");
