/** Official career figures and achievements: derived entirely from finalized, recorded match data. */
export type CareerRecord={
  matchId:string;teamId:string;teamName:string;competitionId:string;competitionName:string;
  recordedAt:string;startsAt:string|null;goals:number;assists:number;yellowCards:number;
  redCards:number;cleanSheet:boolean;playerOfMatch:boolean;homeScore:number|null;
  awayScore:number|null;result:"WIN"|"DRAW"|"LOSS"|"UNKNOWN";
};
export type CareerAward={
  id:string;kind:"CHAMPION"|"PLAYER_OF_MATCH"|"MILESTONE";label:string;
  competitionId:string|null;competitionName:string|null;teamId:string|null;teamName:string|null;
  matchId:string|null;achievedAt:string;verified:true;
};
export type CareerChampion={
  competitionId:string;competitionName:string;teamId:string;teamName:string;achievedAt:string;
};
export type CareerTotals={
  matches:number;goals:number;assists:number;yellowCards:number;redCards:number;
  cleanSheets:number;playerOfMatch:number;wins:number;draws:number;losses:number;
  unknownResults:number;winRate:number;
};
export const zeroTotals=():CareerTotals=>({
  matches:0,goals:0,assists:0,yellowCards:0,redCards:0,cleanSheets:0,playerOfMatch:0,
  wins:0,draws:0,losses:0,unknownResults:0,winRate:0,
});
/** A match counts only once for one player, even if a record was mistakenly replicated. */
export function uniqueOfficialRecords(records:CareerRecord[]):CareerRecord[]{
  const seen=new Set<string>();
  return [...records].sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)||a.matchId.localeCompare(b.matchId))
    .filter(record=>{if(seen.has(record.matchId))return false;seen.add(record.matchId);return true;});
}
export function careerTotals(rows:CareerRecord[]):CareerTotals{
  const totals=zeroTotals();
  for(const row of uniqueOfficialRecords(rows)){
    totals.matches++;totals.goals+=row.goals;totals.assists+=row.assists;
    totals.yellowCards+=row.yellowCards;totals.redCards+=row.redCards;
    if(row.cleanSheet)totals.cleanSheets++;
    if(row.playerOfMatch)totals.playerOfMatch++;
    if(row.result==="WIN")totals.wins++;
    else if(row.result==="DRAW")totals.draws++;
    else if(row.result==="LOSS")totals.losses++;
    else totals.unknownResults++;
  }
  const decided=totals.wins+totals.draws+totals.losses;
  totals.winRate=decided?Math.round(totals.wins*100/decided):0;
  return totals;
}
export function officialMatchResult(homeTeamId:string|null,awayTeamId:string|null,teamId:string,
  homeScore:number|null,awayScore:number|null):CareerRecord["result"]{
  if(homeScore===null||awayScore===null)return "UNKNOWN";
  if(teamId!==homeTeamId&&teamId!==awayTeamId)return "UNKNOWN";
  const mine=teamId===homeTeamId?homeScore:awayScore,opponent=teamId===homeTeamId?awayScore:homeScore;
  return mine>opponent?"WIN":mine<opponent?"LOSS":"DRAW";
}
export function careerAwards(rows:CareerRecord[],champions:CareerChampion[]):CareerAward[]{
  const ordered=uniqueOfficialRecords(rows);
  const awards:CareerAward[]=[];
  for(const row of ordered){
    if(row.playerOfMatch)awards.push({
      id:"pom:"+row.matchId,kind:"PLAYER_OF_MATCH",label:"PLAYER_OF_MATCH",
      competitionId:row.competitionId,competitionName:row.competitionName,
      teamId:row.teamId,teamName:row.teamName,matchId:row.matchId,achievedAt:row.recordedAt,verified:true,
    });
  }
  const ownChampions=new Set<string>();
  for(const champ of champions){
    if(ownChampions.has(champ.competitionId))continue;
    // A trophy is claimable only by a competition-rostered player with an official appearance for the winner.
    if(!ordered.some(r=>r.competitionId===champ.competitionId&&r.teamId===champ.teamId))continue;
    ownChampions.add(champ.competitionId);
    awards.push({id:"champion:"+champ.competitionId,kind:"CHAMPION",label:"CHAMPION",
      competitionId:champ.competitionId,competitionName:champ.competitionName,teamId:champ.teamId,
      teamName:champ.teamName,matchId:null,achievedAt:champ.achievedAt,verified:true});
  }
  let goals=0;
  const matchMilestones=new Map([[1,"FIRST_MATCH"],[10,"TEN_MATCHES"],[50,"FIFTY_MATCHES"],[100,"HUNDRED_MATCHES"]]);
  const goalMilestones=new Map([[1,"FIRST_GOAL"],[25,"TWENTY_FIVE_GOALS"],[50,"FIFTY_GOALS"],[100,"HUNDRED_GOALS"]]);
  const already=new Set<string>();
  const mark=(label:string,row:CareerRecord)=>{
    if(already.has(label))return;
    already.add(label);
    awards.push({id:"milestone:"+label,kind:"MILESTONE",label,
      competitionId:row.competitionId,competitionName:row.competitionName,
      teamId:row.teamId,teamName:row.teamName,matchId:row.matchId,achievedAt:row.recordedAt,verified:true});
  };
  for(let index=0;index<ordered.length;index++){
    const row=ordered[index]!;
    const milestone=matchMilestones.get(index+1);
    if(milestone)mark(milestone,row);
    const previous=goals;
    goals+=row.goals;
    for(const [threshold,label] of goalMilestones)if(previous<threshold&&goals>=threshold)mark(label,row);
  }
  return awards.sort((a,b)=>b.achievedAt.localeCompare(a.achievedAt)||a.id.localeCompare(b.id));
}
/** Gregorian year of a match in Afghanistan, not the device/UTC year. */
export function kabulYear(value:string):number{
  return Number(new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Kabul",calendar:"gregory",year:"numeric",
  }).format(new Date(value)));
}
export function kabulMonthKey(value:string):string{
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Kabul",calendar:"gregory",year:"numeric",month:"2-digit",
  }).formatToParts(new Date(value));
  return (parts.find(p=>p.type==="year")?.value??"0000")+"-"+
    (parts.find(p=>p.type==="month")?.value??"00");
}
