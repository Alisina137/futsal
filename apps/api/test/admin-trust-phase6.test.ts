import {describe,it,expect} from "vitest";
import request from "supertest";
import {createApp} from "../src/app.js";
import {AuthService} from "../src/modules/auth/auth.service.js";
import {TokenService} from "../src/modules/auth/token.service.js";
import type {AdminTrustService} from "../src/modules/trust/admin-trust.service.js";
import {FakeAuthRepository} from "./fake-auth-repository.js";
const valid="11111111-1111-4111-8111-111111111111";
const ticket="22222222-2222-4222-8222-222222222222";
function setup(){
 const tokens=new TokenService("test-secret-that-is-longer-than-thirty-two-characters","test","test-mobile");
 const calls:Array<{type:string;arg:unknown}>=[];
 const service={
   moderation:async(filters:unknown)=>{calls.push({type:"moderation",arg:filters});
     return {items:[],total:0,page:1,pageSize:25,hasMore:false};},
   reports:async(filters:unknown)=>{calls.push({type:"reports",arg:filters});
     return {items:[],total:0,page:1,pageSize:25,hasMore:false};},
   tickets:async(filters:unknown,userId?:string)=>{calls.push({type:"tickets",arg:{filters,userId}});
     return {items:[],total:0,page:1,pageSize:25,hasMore:false};},
   createTicket:async(actor:string,input:unknown)=>{calls.push({type:"createTicket",arg:{actor,input}});
     return {id:ticket,status:"OPEN"};},
   submitReport:async(actor:string,input:unknown)=>{calls.push({type:"report",arg:{actor,input}});
     return {id:valid,status:"OPEN"};},
   ticketDetail:async(id:string,actor:string,admin:boolean)=>{calls.push({type:"ticketDetail",arg:{id,actor,admin}});
     if(!admin&&actor!=="user")throw new Error("owner-only read test");
     return {ticket:{id},events:[]};},
   replyTicket:async(actor:string,id:string,note:string,admin?:boolean)=>{
     calls.push({type:"reply",arg:{actor,id,note,admin}});return {updated:true};},
   moderate:async(actor:string,kind:string,id:string,action:string,reason:string)=>{
     calls.push({type:"moderate",arg:{actor,kind,id,action,reason}});},
   reviewReport:async(actor:string,id:string,status:string,note:string)=>{
     calls.push({type:"reviewReport",arg:{actor,id,status,note}});return {id,status};},
   updateTicket:async(actor:string,id:string,input:unknown)=>{
     calls.push({type:"updateTicket",arg:{actor,id,input}});return {id};},
   announce:async(actor:string,input:unknown)=>{
     calls.push({type:"announce",arg:{actor,input}});return {id:valid};},
   cancelAnnouncement:async(actor:string,id:string,reason:string)=>{
     calls.push({type:"cancel",arg:{actor,id,reason}});},
   dispatchDue:async()=>{calls.push({type:"dispatch",arg:null});},
   listAnnouncements:async()=>({items:[],total:0,page:1,pageSize:25,hasMore:false}),
   deliveries:async()=>({items:[],total:0,page:1,pageSize:25,hasMore:false,summary:[]}),
   requeuePush:async(actor:string,id:string,reason:string)=>{
     calls.push({type:"requeue",arg:{actor,id,reason}});},
 };
 const auth=new AuthService(new FakeAuthRepository(),tokens);
 return {app:createApp({authService:auth,tokenService:tokens,
   adminTrustService:service as unknown as AdminTrustService}),tokens,calls};
}
const bearer=(t:string)=>({Authorization:"Bearer "+t});
describe("Admin Phase 6 request validation and privilege boundaries",()=>{
 it("only PLATFORM_ADMIN can browse and moderate sensitive content",async()=>{
   const {app,tokens,calls}=setup();
   const user=await tokens.createAccessToken("user",[]);
   const admin=await tokens.createAccessToken("admin",["PLATFORM_ADMIN"]);
   for(const endpoint of ["/api/v1/admin/moderation/inventory",
     "/api/v1/admin/reports","/api/v1/admin/support/tickets",
     "/api/v1/admin/announcements","/api/v1/admin/delivery-health"]){
     expect((await request(app).get(endpoint).set(bearer(user.token))).status).toBe(403);
     expect((await request(app).get(endpoint).set(bearer(admin.token))).status).toBe(200);
   }
   const attempt=await request(app).post("/api/v1/admin/moderation/POST/"+valid)
     .send({action:"HIDE",reason:"harassment"}).set(bearer(user.token));
   expect(attempt.status).toBe(403);
   expect(calls.find(v=>v.type==="moderate")).toBeUndefined();
   const accepted=await request(app).post("/api/v1/admin/moderation/POST/"+valid)
     .send({action:"HIDE",reason:"spam report"}).set(bearer(admin.token));
   expect(accepted.status).toBe(200);
   expect(calls.find(v=>v.type==="moderate")?.arg)
     .toMatchObject({kind:"POST",action:"HIDE",reason:"spam report"});
 });
 it("lets regular users submit validated reports and support tickets only as themselves",async()=>{
   const {app,tokens,calls}=setup();
   const user=await tokens.createAccessToken("user",[]);
   const h=bearer(user.token);
   expect((await request(app).post("/api/v1/trust/reports").set(h)
     .send({targetType:"VENUE",targetId:valid,category:"FRAUD",description:"suspected fake venue address"})).status).toBe(201);
   expect(calls.find(v=>v.type==="report")?.arg).toMatchObject({actor:"user"});
   expect((await request(app).post("/api/v1/trust/reports").set(h)
     .send({targetType:"VENUE",targetId:valid,category:"BAD",description:"suspected fake venue address"})).status).toBe(400);
   expect((await request(app).post("/api/v1/trust/tickets").set(h)
     .send({category:"PAYMENTS",subject:"Cannot activate",description:"Payment reference not approved"})).status).toBe(201);
   expect((await request(app).get("/api/v1/trust/tickets").set(h)).status).toBe(200);
   expect(calls.find(v=>v.type==="tickets")?.arg).toMatchObject({userId:"user"});
   expect((await request(app).get("/api/v1/trust/tickets/"+ticket).set(h)).status).toBe(200);
   expect(calls.find(v=>v.type==="ticketDetail")?.arg).toMatchObject({actor:"user",admin:false});
   expect((await request(app).post("/api/v1/trust/tickets/"+ticket+"/replies").set(h)
     .send({note:"x"})).status).toBe(400);
 });
 it("requires an audit reason for actions, supports validated transitions and schedules",async()=>{
   const {app,tokens,calls}=setup();
   const admin=await tokens.createAccessToken("admin",["PLATFORM_ADMIN"]);
   const h=bearer(admin.token);
   expect((await request(app).post("/api/v1/admin/moderation/COMMENT/"+valid)
     .send({action:"HIDE",reason:"a"}).set(h)).status).toBe(400);
   expect((await request(app).patch("/api/v1/admin/reports/"+valid).set(h)
     .send({status:"OPEN",note:"investigated"})).status).toBe(400);
   expect((await request(app).patch("/api/v1/admin/reports/"+valid).set(h)
     .send({status:"RESOLVED",note:"confirmed spam"})).status).toBe(200);
   expect((await request(app).patch("/api/v1/admin/support/tickets/"+ticket).set(h)
     .send({status:"IN_PROGRESS",priority:"HIGH",assignedToUserId:null,note:"taking ticket"})).status).toBe(200);
   expect((await request(app).post("/api/v1/admin/announcements").set(h)
     .send({title:"Welcome",body:"We are upgrading services",audience:"ALL",
       audienceValue:null,scheduledAt:"2026-10-11T17:00:00.000Z"})).status).toBe(201);
   expect(calls.find(v=>v.type==="announce")?.arg)
     .toMatchObject({input:{audience:"ALL",audienceValue:null}});
   expect((await request(app).post("/api/v1/admin/announcements").set(h)
     .send({title:"X",body:"short",audience:"USER",audienceValue:null,
       scheduledAt:"2026-10-11T17:00:00.000Z"})).status).toBe(400);
   expect((await request(app).post("/api/v1/admin/delivery-health/"+valid+"/requeue").set(h)
     .send({reason:"retry after outage"})).status).toBe(200);
   expect(calls.find(v=>v.type==="requeue")).toBeDefined();
 });
});
