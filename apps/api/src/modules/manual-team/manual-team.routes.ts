import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { manualTeamClaimRequestSchema, manualTeamCreateRequestSchema, manualTeamUpdateRequestSchema } from "@leaguekick/contracts";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";
import type { ManualTeamService } from "./manual-team.service.js";

const uuid=z.string().uuid();
const limiter=rateLimit({windowMs:60_000,limit:30,standardHeaders:"draft-8",legacyHeaders:false});
export function createOwnerManualTeamRouter(service:ManualTeamService,tokens:TokenService){
  const router=Router();
  router.use(requireAuth(tokens),requireRole("VENUE_OWNER"));
  router.get("/manual-teams",async(req,res,next)=>{try{res.json(await service.listOwner(req.auth!.userId));}catch(e){next(e);}});
  router.post("/manual-teams",limiter,async(req,res,next)=>{
    try{const input=manualTeamCreateRequestSchema.parse(req.body);res.status(201).json({team:await service.create(req.auth!.userId,input)});}catch(e){next(e);}
  });
  router.patch("/manual-teams/:teamId",limiter,async(req,res,next)=>{
    try{const id=uuid.parse(req.params.teamId);const input=manualTeamUpdateRequestSchema.parse(req.body);res.json({team:await service.update(req.auth!.userId,id,input)});}catch(e){next(e);}
  });
  router.post("/competitions/:competitionId/manual-teams/:teamId",limiter,async(req,res,next)=>{
    try{const cid=uuid.parse(req.params.competitionId);const tid=uuid.parse(req.params.teamId);res.status(201).json({registration:await service.register(req.auth!.userId,cid,tid)});}catch(e){next(e);}
  });
  return router;
}
export function createAdminManualTeamRouter(service:ManualTeamService,tokens:TokenService){
  const router=Router();
  router.use(requireAuth(tokens),requireRole("PLATFORM_ADMIN"));
  router.get("/manual-teams",async(_req,res,next)=>{try{res.json(await service.listUnclaimedForAdmin());}catch(e){next(e);}});
  router.post("/manual-teams/:teamId/assign",limiter,async(req,res,next)=>{
    try{const id=uuid.parse(req.params.teamId);const input=manualTeamClaimRequestSchema.parse(req.body);res.json({assignment:await service.assign(req.auth!.userId,id,input)});}catch(e){next(e);}
  });
  return router;
}
