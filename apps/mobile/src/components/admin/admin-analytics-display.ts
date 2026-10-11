import type {AdminAnalyticsResponse} from "@leaguekick/contracts";

export type AnalyticsMeasure=Exclude<keyof AdminAnalyticsResponse["daily"][number],"date">;
export type AnalyticsInterval="day"|"week"|"month";
export type AnalyticsBar={date:string;value:number};

export function groupAnalyticsDaily(
  days:readonly AdminAnalyticsResponse["daily"][number][],
  field:AnalyticsMeasure,interval:AnalyticsInterval,
):AnalyticsBar[]{
  const map=new Map<string,number>();
  for(const day of days){
    const at=new Date(day.date+"T00:00:00Z");
    if(!Number.isFinite(at.getTime()))continue;
    let label=day.date;
    if(interval==="week"){
      at.setUTCDate(at.getUTCDate()-(at.getUTCDay()+6)%7);
      label=at.toISOString().slice(0,10);
    }else if(interval==="month")label=day.date.slice(0,7)+"-01";
    map.set(label,(map.get(label)??0)+day[field]);
  }
  return [...map].sort(([a],[b])=>a.localeCompare(b))
    .map(([date,value])=>({date,value}));
}
export function safeRatio(part:number,total:number):number{
  return total>0?Math.round((part/total)*100):0;
}
