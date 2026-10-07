import type { VenueTimetableDraftRequest } from "@leaguekick/contracts";

export type TimetableDayDraft={
  dayOfWeek:number;
  periods:Array<{startsAt:string;endsAt:string}>;
};

export type TimetableDraftValidationError=
  |"NAME"
  |"DATE"
  |"DATE_RANGE"
  |"DURATION"
  |"BUFFER"
  |"AREA"
  |"EMPTY"
  |"TIME"
  |"OVERLAP";

const persianDigits="۰۱۲۳۴۵۶۷۸۹";
const arabicDigits="٠١٢٣٤٥٦٧٨٩";

export function normalizeLocalizedDigits(value:string){
  return value
    .replace(/[۰-۹]/g,(digit)=>String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g,(digit)=>String(arabicDigits.indexOf(digit)))
    .trim();
}

function validDate(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const parsed=new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}

function validTime(value:string){
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function minutes(value:string){
  const [hour,minute]=value.split(":").map(Number);
  return (hour??0)*60+(minute??0);
}

function hhmm(total:number){
  const bounded=Math.max(0,Math.min(total,23*60+59));
  return `${String(Math.floor(bounded/60)).padStart(2,"0")}:${String(bounded%60).padStart(2,"0")}`;
}

export function suggestNextPeriod(periods:Array<{startsAt:string;endsAt:string}>){
  const normalized=periods
    .map((period)=>({
      startsAt:normalizeLocalizedDigits(period.startsAt),
      endsAt:normalizeLocalizedDigits(period.endsAt),
    }))
    .filter((period)=>validTime(period.startsAt)&&validTime(period.endsAt))
    .sort((a,b)=>a.startsAt.localeCompare(b.startsAt));

  if(!normalized.length)return {startsAt:"08:00",endsAt:"09:30"};

  const gaps:Array<{start:number;end:number}>=[];
  let cursor=0;
  for(const period of normalized){
    const start=minutes(period.startsAt);
    const end=minutes(period.endsAt);
    if(start-cursor>=30)gaps.push({start:cursor,end:start});
    cursor=Math.max(cursor,end);
  }
  if((24*60)-cursor>=30)gaps.push({start:cursor,end:24*60});

  // Prefer space after the last existing period. If there is none, use the
  // first real gap instead of creating an overlapping default.
  const preferred=gaps.find((gap)=>gap.start>=cursor)??gaps[0];
  if(!preferred)return null;
  const length=Math.min(90,preferred.end-preferred.start);
  if(length<30)return null;
  return {
    startsAt:hhmm(preferred.start),
    endsAt:hhmm(preferred.start+length),
  };
}

export function buildTimetableDraft(input:{
  name:string;
  effectiveFrom:string;
  effectiveUntil:string;
  duration:string;
  buffer:string;
  allAreas:boolean;
  selectedAreaIds:string[];
  days:TimetableDayDraft[];
}):{draft:VenueTimetableDraftRequest|null;error:TimetableDraftValidationError|null}{
  const name=input.name.trim();
  const effectiveFrom=normalizeLocalizedDigits(input.effectiveFrom);
  const effectiveUntil=normalizeLocalizedDigits(input.effectiveUntil);
  const durationText=normalizeLocalizedDigits(input.duration);
  const bufferText=normalizeLocalizedDigits(input.buffer);
  const defaultSlotDurationMinutes=Number(durationText);
  const bufferMinutes=Number(bufferText);

  if(name.length<2)return {draft:null,error:"NAME"};
  if(!validDate(effectiveFrom)||(effectiveUntil&&!validDate(effectiveUntil)))return {draft:null,error:"DATE"};
  if(effectiveUntil&&effectiveUntil<effectiveFrom)return {draft:null,error:"DATE_RANGE"};
  if(!Number.isInteger(defaultSlotDurationMinutes)||defaultSlotDurationMinutes<30||defaultSlotDurationMinutes>240){
    return {draft:null,error:"DURATION"};
  }
  if(!Number.isInteger(bufferMinutes)||bufferMinutes<0||bufferMinutes>60){
    return {draft:null,error:"BUFFER"};
  }
  if(!input.allAreas&&!input.selectedAreaIds.length)return {draft:null,error:"AREA"};

  const normalizedDays=input.days.map((day)=>({
    dayOfWeek:day.dayOfWeek,
    periods:day.periods.map((period)=>({
      startsAt:normalizeLocalizedDigits(period.startsAt),
      endsAt:normalizeLocalizedDigits(period.endsAt),
    })),
  }));
  if(!normalizedDays.some((day)=>day.periods.length))return {draft:null,error:"EMPTY"};

  for(const day of normalizedDays){
    for(const period of day.periods){
      if(!validTime(period.startsAt)||!validTime(period.endsAt)||period.startsAt>=period.endsAt){
        return {draft:null,error:"TIME"};
      }
    }
    const sorted=[...day.periods].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
    for(let index=1;index<sorted.length;index+=1){
      if(sorted[index]!.startsAt<sorted[index-1]!.endsAt){
        return {draft:null,error:"OVERLAP"};
      }
    }
  }

  const scopes:(string|null)[]=input.allAreas?[null]:input.selectedAreaIds;
  const periods=normalizedDays.flatMap((day)=>
    day.periods.flatMap((period)=>
      scopes.map((areaId)=>({
        areaId,
        dayOfWeek:day.dayOfWeek,
        startsAt:period.startsAt,
        endsAt:period.endsAt,
      }))
    )
  );

  return {
    draft:{
      name,
      effectiveFrom,
      effectiveUntil:effectiveUntil||null,
      defaultSlotDurationMinutes,
      bufferMinutes,
      periods,
    },
    error:null,
  };
}
