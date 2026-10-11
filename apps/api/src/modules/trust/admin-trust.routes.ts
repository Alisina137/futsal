import {Router} from "express";
import {rateLimit} from "express-rate-limit";
import {z} from "zod";
import {
  adminAnnouncementCreateSchema,adminDeliveryRetrySchema,adminModerationActionSchema,
  adminModerationKindSchema,adminPhase6PageSchema,adminReportCreateSchema,
  adminReportReviewSchema,adminReportTargetSchema,supportTicketCreateSchema,
  supportTicketMessageSchema,supportTicketUpdateSchema,
} from "@leaguekick/contracts";
import {requireAuth,requireRole} from "../../middleware/auth.js";
import type {TokenService} from "../auth/token.service.js";
import type {AdminTrustService} from "./admin-trust.service.js";
const uid=z.string().uuid();
const page=adminPhase6PageSchema;
const limiter=rateLimit({windowMs:60_000,limit:8,standardHeaders:"draft-8",legacyHeaders:false});
const moderateKind=adminModerationKindSchema.or(z.literal("USER"));
const cancel=z.object({reason:z.string().trim().min(3).max(500)}).strict();

export function createUserTrustRouter(service:AdminTrustService,tokens:TokenService){
  const r=Router();
  r.use(requireAuth(tokens));
  r.post("/reports",limiter,async(req,res,next)=>{
    try{res.status(201).json(await service.submitReport(req.auth!.userId,
      adminReportCreateSchema.parse(req.body)));}
    catch(e){next(e);}
  });
  r.get("/tickets",async(req,res,next)=>{
    try{res.json(await service.tickets(page.parse(req.query),req.auth!.userId));}
    catch(e){next(e);}
  });
  r.post("/tickets",limiter,async(req,res,next)=>{
    try{res.status(201).json(await service.createTicket(req.auth!.userId,
      supportTicketCreateSchema.parse(req.body)));}
    catch(e){next(e);}
  });
  r.get("/tickets/:id",async(req,res,next)=>{
    try{res.json(await service.ticketDetail(uid.parse(req.params.id),req.auth!.userId,false));}
    catch(e){next(e);}
  });
  r.post("/tickets/:id/replies",limiter,async(req,res,next)=>{
    try{
      const id=uid.parse(req.params.id),input=supportTicketMessageSchema.parse(req.body);
      res.json(await service.replyTicket(req.auth!.userId,id,input.note));
    }catch(e){next(e);}
  });
  return r;
}
export function createAdminTrustRouter(service:AdminTrustService,tokens:TokenService){
  const r=Router();
  r.use(requireAuth(tokens),requireRole("PLATFORM_ADMIN"));
  r.get("/moderation/inventory",async(req,res,next)=>{
    try{res.json(await service.moderation(page.parse(req.query)));}
    catch(e){next(e);}
  });
  r.post("/moderation/:kind/:id",async(req,res,next)=>{
    try{
      const kind=moderateKind.parse(req.params.kind);
      const id=uid.parse(req.params.id);
      const {action,reason}=adminModerationActionSchema.parse(req.body);
      await service.moderate(req.auth!.userId,kind,id,action,reason);
      res.json({updated:true});
    }catch(e){next(e);}
  });
  r.get("/reports",async(req,res,next)=>{
    try{res.json(await service.reports(page.parse(req.query)));}
    catch(e){next(e);}
  });
  r.patch("/reports/:id",async(req,res,next)=>{
    try{
      const id=uid.parse(req.params.id),{status,note}=adminReportReviewSchema.parse(req.body);
      res.json({item:await service.reviewReport(req.auth!.userId,id,status,note)});
    }catch(e){next(e);}
  });
  r.get("/support/tickets",async(req,res,next)=>{
    try{res.json(await service.tickets(page.parse(req.query)));}
    catch(e){next(e);}
  });
  r.get("/support/tickets/:id",async(req,res,next)=>{
    try{res.json(await service.ticketDetail(uid.parse(req.params.id),req.auth!.userId,true));}
    catch(e){next(e);}
  });
  r.patch("/support/tickets/:id",async(req,res,next)=>{
    try{
      const id=uid.parse(req.params.id),input=supportTicketUpdateSchema.parse(req.body);
      res.json({item:await service.updateTicket(req.auth!.userId,id,input)});
    }catch(e){next(e);}
  });
  r.post("/support/tickets/:id/replies",async(req,res,next)=>{
    try{
      const id=uid.parse(req.params.id),{note}=supportTicketMessageSchema.parse(req.body);
      res.json(await service.replyTicket(req.auth!.userId,id,note,true));
    }catch(e){next(e);}
  });
  r.get("/announcements",async(req,res,next)=>{
    try{res.json(await service.listAnnouncements(page.parse(req.query)));}
    catch(e){next(e);}
  });
  r.post("/announcements",async(req,res,next)=>{
    try{
      const input=adminAnnouncementCreateSchema.parse(req.body);
      res.status(201).json({item:await service.announce(req.auth!.userId,input)});
    }catch(e){next(e);}
  });
  r.post("/announcements/:id/cancel",async(req,res,next)=>{
    try{
      const {reason}=cancel.parse(req.body);
      await service.cancelAnnouncement(req.auth!.userId,uid.parse(req.params.id),reason);
      res.json({cancelled:true});
    }catch(e){next(e);}
  });
  r.post("/announcements/process-due",async(_req,res,next)=>{
    try{await service.dispatchDue();res.json({processed:true});}
    catch(e){next(e);}
  });
  r.get("/delivery-health",async(req,res,next)=>{
    try{res.json(await service.deliveries(page.parse(req.query)));}
    catch(e){next(e);}
  });
  r.post("/delivery-health/:id/requeue",async(req,res,next)=>{
    try{
      const {reason}=adminDeliveryRetrySchema.parse(req.body);
      await service.requeuePush(req.auth!.userId,uid.parse(req.params.id),reason);
      res.json({queued:true});
    }catch(e){next(e);}
  });
  return r;
}
