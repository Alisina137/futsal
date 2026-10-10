/** Dependency-free A4 referee report PDF.
 * The visible report uses PDF's portable Latin font; the original UTF-8
 * multilingual text is included as an embedded full-report.txt attachment.
 * Never silently discard Unicode source data.
 */
type ExportEvent={kind:string;side:string|null;playerUserId:string|null;elapsedSeconds:number;period:number;details:string};
export type ExportReport={
 matchId:string;competitionName:string;venueName:string;refereeName:string;
 homeName:string;awayName:string;startedAt:Date|null;finishedAt:Date|null;reviewedAt:Date|null;
 score:{homeScore:number;awayScore:number};events:ExportEvent[];summary:string;
};
function portable(value:string){
 const latin=value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
 return /[^\x20-\x7E]/.test(latin)?"[Original text in attached full-report.txt]":latin;
}
function escapePdf(value:string){return portable(value).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");}
function wrap(text:string,width=91){
 const words=text.split(/\s+/),out:string[]=[];let line="";
 for(const word of words){
   if(line&&line.length+word.length+1>width){out.push(line);line="";}
   if(word.length>width){if(line){out.push(line);line="";}
     for(let pos=0;pos<word.length;pos+=width)out.push(word.slice(pos,pos+width));
   }else line+=(line?" ":"")+word;
 }
 if(line)out.push(line);
 return out.length?out:[""];
}
function stamp(value:Date|null){return value?value.toISOString().replace("T"," ").slice(0,19)+" UTC":"-";}
export function createRefereeReportPdf(data:ExportReport):Buffer{
 const lines:string[]=[];
 const add=(label:string,value:string)=>{for(const l of wrap(label+": "+portable(value)))lines.push(l);};
 add("Reference ID",data.matchId);
 add("Competition",data.competitionName);
 add("Venue",data.venueName);
 add("Referee",data.refereeName);
 add("Teams",data.homeName+"  VS  "+data.awayName);
 add("Official score",data.score.homeScore+" - "+data.score.awayScore);
 add("Kickoff",stamp(data.startedAt));add("Final whistle",stamp(data.finishedAt));
 add("Approved",stamp(data.reviewedAt));
 lines.push("","OFFICIATING EVENTS");
 if(!data.events.length)lines.push("No events recorded.");
 data.events.forEach((e,i)=>{
   add(String(i+1).padStart(2,"0")+"  Period "+e.period+" "+Math.floor(e.elapsedSeconds/60)+":"+
     String(e.elapsedSeconds%60).padStart(2,"0"),
     e.kind+" / "+(e.side??"-")+(e.playerUserId?" / player "+e.playerUserId:""));
   if(e.details)for(const l of wrap("     Note: "+portable(e.details)))lines.push(l);
 });
 lines.push("","REFEREE SUMMARY");
 for(const l of wrap(portable(data.summary)||"No additional notes."))lines.push(l);
 lines.push("","Signed digitally by approval workflow. Source data is attached.");
 lines.push("Non-Latin original names/notes are preserved in full-report.txt.");
 const perPage=43;
 const pages:Array<string[]>=[];for(let i=0;i<lines.length;i+=perPage)pages.push(lines.slice(i,i+perPage));
 const objects:Buffer[]=[];const reserve=()=>{objects.push(Buffer.alloc(0));return objects.length;};
 const set=(id:number,v:string|Buffer)=>{objects[id-1]=typeof v==="string"?Buffer.from(v,"utf8"):v;};
 const catalog=reserve(),pageRoot=reserve(),regular=reserve(),bold=reserve(),embedded=reserve(),file=reserve();
 set(regular,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
 set(bold,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
 const raw=Buffer.from(JSON.stringify({
   matchId:data.matchId,competition:data.competitionName,venue:data.venueName,
   referee:data.refereeName,homeTeam:data.homeName,awayTeam:data.awayName,
   score:data.score,startedAt:data.startedAt,finishedAt:data.finishedAt,
   approvedAt:data.reviewedAt,summary:data.summary,events:data.events,
 },null,2),"utf8");
 set(embedded,Buffer.concat([Buffer.from(`<< /Type /EmbeddedFile /Subtype /text#2Fplain /Length ${raw.length} >>\nstream\n`),
   raw,Buffer.from("\nendstream")]));
 set(file,`<< /Type /Filespec /F (full-report.txt) /UF (full-report.txt) /EF << /F ${embedded} 0 R >> >>`);
 const pageIds:number[]=[];
 for(let i=0;i<pages.length;i++){
   let body="q 0.055 0.21 0.44 rg 0 780 595 62 re f Q\n";
   body+="BT /F2 17 Tf 1 1 1 rg 39 808 Td (FUTSAL  /  REFEREE MATCH REPORT) Tj ET\n";
   body+="BT /F1 9 Tf 0.2 0.35 0.58 rg 41 760 Td (OFFICIAL RECORD / Page "+(i+1)+
     " of "+pages.length+") Tj ET\n";
   for(let y=744,j=0;j<pages[i]!.length;j++,y-=15){
     const text=pages[i]![j]!;
     if(text==="OFFICIATING EVENTS"||text==="REFEREE SUMMARY"){
       body+=`BT /F2 10 Tf 0.07 0.29 0.56 rg 41 ${y} Td (${escapePdf(text)}) Tj ET\n`;
     }else body+=`BT /F1 9 Tf 0.10 0.16 0.24 rg 41 ${y} Td (${escapePdf(text)}) Tj ET\n`;
   }
   body+="q 0.85 0.89 0.94 rg 40 48 515 0.8 re f Q\n";
   body+="BT /F1 8 Tf 0.37 0.44 0.56 rg 41 33 Td (FUTSAL / APPROVED MATCH RECORD / Verify in application) Tj ET\n";
   const buf=Buffer.from(body,"ascii"),streamId=reserve(),pageId=reserve();
   set(streamId,Buffer.concat([Buffer.from(`<< /Length ${buf.length} >>\nstream\n`),buf,Buffer.from("endstream")]));
   set(pageId,`<< /Type /Page /Parent ${pageRoot} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${streamId} 0 R >>`);
   pageIds.push(pageId);
 }
 set(pageRoot,`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>id+" 0 R").join(" ")}] >>`);
 set(catalog,`<< /Type /Catalog /Pages ${pageRoot} 0 R /Names << /EmbeddedFiles << /Names [(full-report.txt) ${file} 0 R] >> >> /PageMode /UseAttachments >>`);
 const chunks=[Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n","latin1")],offsets=[0];
 let length=chunks[0]!.length;
 for(let i=0;i<objects.length;i++){
   offsets.push(length);
   const obj=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),objects[i]!,Buffer.from("\nendobj\n")]);
   chunks.push(obj);length+=obj.length;
 }
 const xref=length;
 let table=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(let i=1;i<offsets.length;i++)table+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
 table+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 chunks.push(Buffer.from(table));
 return Buffer.concat(chunks);
}
