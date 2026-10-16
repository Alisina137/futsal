/** Player career presentation calculations (Kabul-local, independent of private API state). */
export type CareerLanguage="en"|"fa-AF"|"ps-AF";
export type CareerMetric="matches"|"goals"|"assists";
export type CareerResult="WIN"|"DRAW"|"LOSS"|"UNKNOWN";
export type CareerViewRow={
  matchId:string;recordedAt:string;goals:number;assists:number;result:CareerResult;
};
/** Intl calendar is chosen with the UI language, not the device's default locale. */
function calendarFormat(language:CareerLanguage,options:Intl.DateTimeFormatOptions){
  const calendar=language==="en"?"gregory":"persian";
  // Some Android Intl builds do not include the Persian calendar; fall back
  // consistently to Gregorian instead of crashing or mixing calendar years.
  try{
    const formatter=new Intl.DateTimeFormat(language==="en"?"en-GB":language,{
      timeZone:"Asia/Kabul",calendar,...options,
    });
    if(formatter.resolvedOptions().calendar===calendar)return formatter;
  }catch{}
  return new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Kabul",calendar:"gregory",...options,
  });
}
export function careerPeriod(value:string,language:CareerLanguage){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return {year:"0000",month:"00",key:"0000-00"};
  const parts=calendarFormat(language,{year:"numeric",month:"2-digit",numberingSystem:"latn"})
    .formatToParts(date);
  const part=(type:string)=>parts.find(x=>x.type===type)?.value??"";
  const digits=(value:string)=>value.replace(/[^0-9]/g,"");
  const year=digits(part("year")).padStart(4,"0");
  const month=digits(part("month")).padStart(2,"0");
  return {year,month,key:year+"-"+month};
}
/** All displayed career dates match the season and trend calendar. Clock remains AM/PM. */
export function careerDateTime(value:string,language:CareerLanguage){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return value;
  const day=calendarFormat(language,{year:"numeric",month:"short",day:"numeric"}).format(date);
  const clock=new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Kabul",hour:"numeric",minute:"2-digit",hour12:true,
  }).format(date).replace(/[\u00a0\u202f]/g," ");
  return day+" · "+clock;
}
export function careerResults<T extends CareerViewRow>(rows:T[],result:CareerResult|"ALL"):T[]{
  const seen=new Set<string>();
  return rows.filter(row=>result==="ALL"||row.result===result)
    .sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)||a.matchId.localeCompare(b.matchId))
    .filter(row=>{if(seen.has(row.matchId))return false;seen.add(row.matchId);return true;});
}
export function careerMonthlyTrend(rows:CareerViewRow[],metric:CareerMetric,
  language:CareerLanguage){
  const monthCounts=new Map<string,{matches:number;goals:number;assists:number}>();
  const seen=new Set<string>();
  for(const row of rows){
    if(seen.has(row.matchId))continue;
    seen.add(row.matchId);
    const key=careerPeriod(row.recordedAt,language).key;
    const counts=monthCounts.get(key)??{matches:0,goals:0,assists:0};
    counts.matches++;counts.goals+=row.goals;counts.assists+=row.assists;
    monthCounts.set(key,counts);
  }
  return [...monthCounts.entries()].sort((a,b)=>a[0].localeCompare(b[0]))
    .slice(-12).map(([key,counts])=>({key,value:counts[metric]}));
}
export function careerPersonalBest(rows:CareerViewRow[]){
  const seen=new Set<string>();
  let goals=0,assists=0;
  for(const row of rows){
    if(seen.has(row.matchId))continue;
    seen.add(row.matchId);
    goals=Math.max(goals,row.goals);
    assists=Math.max(assists,row.assists);
  }
  return {goals,assists};
}
