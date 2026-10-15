/** Team Detail's outcome decoration is viewer-relative and only applies
 * to official, scored Results. Venue cards and upcoming fixtures stay neutral. */
export type TeamResultOutcome="win"|"loss"|"draw";
export type TeamResultTheme={border:string;surface:string;text:string};
const palettes:Record<TeamResultOutcome,TeamResultTheme>={
  win:{border:"#86EFAC",surface:"#F0FDF4",text:"#166534"},
  loss:{border:"#FCA5A5",surface:"#FEF2F2",text:"#991B1B"},
  draw:{border:"#CBD5E1",surface:"#F1F5F9",text:"#475569"},
};

export function teamResultTheme(input:{
  scope:"upcoming"|"results";status:string;
  homeScore:number|null;awayScore:number|null;
  outcome:TeamResultOutcome|null|undefined;
}):TeamResultTheme|null{
  const {scope,status,homeScore,awayScore,outcome}=input;
  if(scope!=="results"||(status!=="COMPLETED"&&status!=="CORRECTED")||
    !outcome||homeScore===null||awayScore===null||
    !Number.isSafeInteger(homeScore)||homeScore<0||
    !Number.isSafeInteger(awayScore)||awayScore<0)return null;
  if((outcome==="draw")!==(homeScore===awayScore))return null;
  return palettes[outcome];
}
