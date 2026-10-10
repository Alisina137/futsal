import {Router,type Request,type Response,type NextFunction} from "express";
import {rateLimit} from "express-rate-limit";
import {z} from "zod";
import {requireAuth,requireRole} from "../../middleware/auth.js";
import type {TokenService} from "../auth/token.service.js";
import type {TeamSlotsService} from "./team-slots.js";
const requestInput=z.object({paymentReference:z.string().trim().max(120).optional().or(z.literal("")),
  renewSlotId:z.string().uuid().nullable().optional()}).strict();
const activation=z.object({months:z.number().int().min(1).max(24),
  paymentReference:z.string().trim().min(1).max(120)}).strict();
const adminPath=z.string().uuid();
export function createTeamSlotRouter(service:TeamSlotsService,tokens:TokenService){
  const router=Router(),auth=requireAuth(tokens);
  const writeLimit=rateLimit({windowMs:60_000,limit:10,standardHeaders:"draft-8",legacyHeaders:false});
  router.get("/teams/manager/capacity",auth,async(req:Request,res:Response,next:NextFunction)=>{
    try{res.json(await service.capacity(req.auth!.userId));}catch(e){next(e);}
  });
  router.post("/teams/manager/slots/request",auth,writeLimit,
    async(req:Request,res:Response,next:NextFunction)=>{
      try{
        const input=requestInput.parse(req.body);
        res.json(await service.request(req.auth!.userId,input.paymentReference?.trim()||null,
          input.renewSlotId??null));
      }catch(e){next(e);}
    });
  return router;
}
export function createAdminTeamSlotRouter(service:TeamSlotsService,tokens:TokenService){
  const router=Router();
  router.use(requireAuth(tokens),requireRole("PLATFORM_ADMIN"));
  router.get("/team-slots",async(_req,res,next)=>{
    try{res.json(await service.adminList());}catch(e){next(e);}
  });
  router.post("/team-slots/:slotId/activate",async(req,res,next)=>{
    try{
      const input=activation.parse(req.body);
      res.json(await service.activate(req.auth!.userId,adminPath.parse(req.params.slotId),
        input.months,input.paymentReference));
    }catch(e){next(e);}
  });
  return router;
}
