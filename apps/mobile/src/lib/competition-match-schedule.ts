import type {CompetitionMatchDto} from "@leaguekick/contracts";
import type {LanguageCode} from "@leaguekick/localization";
import {AFGHANISTAN_TIME_ZONE} from "./date-time";

/** Round is part of the match identity; a calendar date isn't. */
export function groupMatchesByRound(matches:CompetitionMatchDto[]){
  const groups=new Map<string,{
    key:string;stage:CompetitionMatchDto["stage"];roundNumber:number;
    matches:CompetitionMatchDto[];
  }>();
  for(const match of matches){
    const key=match.stage+":"+match.roundNumber;
    let section=groups.get(key);
    if(!section){
      section={key,stage:match.stage,roundNumber:match.roundNumber,matches:[]};
      groups.set(key,section);
    }
    section.matches.push(match);
  }
  // Insertion order retains the order of the selected filter's fixtures:
  // upcoming/live first, latest results first. Every round stays together.
  return [...groups.values()];
}

const locales:Record<LanguageCode,string>={
  en:"en-GB","fa-AF":"fa-AF","ps-AF":"ps-AF",
};
const WEEK_MS=7*24*60*60*1000;

/**
 * Compact Kabul-local display: within seven days show weekday + time,
 * otherwise calendar date + time. The clock never prints seconds or GMT+4:30.
 * Includes recently played matches within the same seven-day window.
 */
export function formatFixtureSchedule(
  value:string|Date|null,
  language:LanguageCode,
  now:Date=new Date(),
):{date:string;time:string;nearby:boolean}|null{
  if(!value)return null;
  const instant=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(instant.getTime()))return null;
  const locale=locales[language];
  const nearby=Number.isFinite(now.getTime())&&
    Math.abs(instant.getTime()-now.getTime())<WEEK_MS;
  const options={calendar:"gregory",timeZone:AFGHANISTAN_TIME_ZONE} as const;
  const date=new Intl.DateTimeFormat(locale,nearby
    ?{...options,weekday:"long"}
    :{...options,day:"numeric",month:"short",year:"numeric"}).format(instant);
  const time=new Intl.DateTimeFormat(locale,{
    ...options,hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  }).format(instant);
  return {date,time,nearby};
}
