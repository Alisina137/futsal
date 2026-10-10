import {describe,it,expect} from "vitest";
import {careerSummary,type CareerRecord} from "../src/modules/referee/referee-career.routes.js";
import {createRefereeReportPdf} from "../src/modules/referee/referee-report-pdf.js";
const now=new Date("2026-10-10T12:00:00Z");
const record=(id:string,when:string,flags:Partial<CareerRecord>={}):CareerRecord=>({
  matchId:id,competitionId:"c1",competitionName:"Kabul League",venueName:"Main Hall",
  homeName:"Home",awayName:"Away",startsAt:new Date(when),finishedAt:new Date(when),
  submittedAt:new Date(Date.parse(when)+300_000),reviewedAt:new Date(Date.parse(when)+900_000),
  homeScore:2,awayScore:1,status:"APPROVED",events:[
    {kind:"GOAL",side:"HOME",playerUserId:null,elapsedSeconds:65,period:1,details:""},
    {kind:"YELLOW_CARD",side:"AWAY",playerUserId:null,elapsedSeconds:99,period:1,details:""},
  ],...flags,
});
describe("referee career analytics",()=>{
  it("counts only approved reports in the filtered window and ignores drafts",()=>{
    const list=[
      record("a","2026-10-09T10:00:00Z"),
      record("b","2026-09-16T10:00:00Z",{submittedAt:new Date("2026-09-19T00:00:00Z")}),
      record("c","2026-10-08T10:00:00Z",{status:"SUBMITTED"}),
      record("d","2025-10-08T10:00:00Z"),
    ];
    const week=careerSummary(list,"7d",now);
    expect(week.total).toBe(1);
    expect(week.events.GOAL).toBe(1);
    expect(week.competitionsCount).toBe(1);
    expect(week.onTimeRate).toBe(100);
    expect(careerSummary(list,"30d",now).total).toBe(2);
    expect(careerSummary(list,"year",now).total).toBe(2);
    expect(careerSummary(list,"all",now).total).toBe(3);
  });
  it("shows twelve continuous calendar months with zero gaps in Kabul",()=>{
    const summary=careerSummary([record("a","2026-10-09T10:00:00Z")],"all",now);
    expect(summary.monthly).toHaveLength(12);
    expect(summary.monthly.at(-1)).toEqual({month:"2026-10",matches:1});
    expect(summary.monthly[0]?.month).toBe("2025-11");
    expect(summary.monthly.filter(m=>m.matches===0)).toHaveLength(11);
  });
  it("handles an empty career without dividing by zero",()=>{
    const summary=careerSummary([],"all",now);
    expect(summary.total).toBe(0);
    expect(summary.submissionRate).toBe(0);
    expect(summary.onTimeRate).toBe(0);
    expect(summary.history).toHaveLength(0);
  });
});
describe("approved report PDF renderer",()=>{
 const report={matchId:"11111111-1111-4111-8111-111111111111",
   competitionName:"لیگ کابل",venueName:"Kabul Arena",refereeName:"پښتو",
   homeName:"Home",awayName:"Away",startedAt:now,finishedAt:now,reviewedAt:now,
   score:{homeScore:2,awayScore:1},summary:"متن کامل گزارش",
   events:[{kind:"GOAL",side:"HOME",playerUserId:null,elapsedSeconds:100,period:1,details:"هدف"}]};
 it("creates a valid PDF envelope with explicit authorization-independent report data",()=>{
   const data=createRefereeReportPdf(report),ascii=data.toString("latin1");
   expect(ascii.startsWith("%PDF-1.4")).toBe(true);
   expect(ascii).toContain("xref\n0 ");
   expect(ascii).toContain("/Type /Pages");
   expect(ascii).toContain("%%EOF");
   expect(ascii).toContain("full-report.txt");
 });
 it("preserves original Unicode names and notes in an embedded UTF-8 file",()=>{
   const data=createRefereeReportPdf(report);
   expect(data.includes(Buffer.from("لیگ کابل","utf8"))).toBe(true);
   expect(data.includes(Buffer.from("پښتو","utf8"))).toBe(true);
   expect(data.includes(Buffer.from("متن کامل گزارش","utf8"))).toBe(true);
 });
 it("paginates long event timelines rather than overflowing a single A4 page",()=>{
   const long=createRefereeReportPdf({...report,events:Array.from({length:125},(_,i)=>({
     ...report.events[0]!,elapsedSeconds:i,details:"Long match incident recorded by the official.",
   }))});
   expect(long.toString("latin1").match(/\/Type \/Page \/Parent/g)?.length).toBeGreaterThan(1);
 });
});
