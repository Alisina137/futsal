/** Match/report career bucket calendar is independent of locale-digit choices.
 * All time boundaries use the Kabul time zone; Persian calendar may gracefully
 * fall back to Gregorian if a Node runtime lacks the corresponding ICU data.
 */
export type RefereeCareerCalendar="gregory"|"persian";
export function supportedCareerCalendar(calendar:RefereeCareerCalendar):RefereeCareerCalendar{
  if(calendar==="gregory")return "gregory";
  try{
    return new Intl.DateTimeFormat("en-GB",{calendar:"persian"})
      .resolvedOptions().calendar==="persian"?"persian":"gregory";
  }catch{return "gregory";}
}
export function careerCalendarParts(
  date:Date,calendar:RefereeCareerCalendar="gregory",
){
  const effective=supportedCareerCalendar(calendar);
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",
    calendar:effective,numberingSystem:"latn",year:"numeric",month:"2-digit"})
    .formatToParts(date);
  const field=(type:string)=>parts.find(part=>part.type===type)?.value??"";
  const year=Number(field("year")),monthNumber=Number(field("month"));
  return {year,month:`${year}-${String(monthNumber).padStart(2,"0")}`};
}
export function careerCalendarMonths(
  now:Date,calendar:RefereeCareerCalendar="gregory",count=12,
){
  const today=careerCalendarParts(now,calendar);
  const initial=today.year*12+Number(today.month.slice(5))-1;
  return Array.from({length:count},(_,index)=>{
    const absolute=initial-(count-1-index);
    return `${Math.floor(absolute/12)}-${String(absolute%12+1).padStart(2,"0")}`;
  });
}
