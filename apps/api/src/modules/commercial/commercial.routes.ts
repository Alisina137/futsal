import {
  adminBillingFiltersSchema,
  adminAuditFilterSchema,
  adminCaseCreateSchema,
  adminCaseFilterSchema,
  adminCaseUpdateSchema,
  adminOperationFiltersSchema,
  adminOperationKindSchema,
  adminSubscriptionActivationRequestSchema,
  adminAnalyticsDaysSchema,
  adminSupportNoteRequestSchema,
  adminTrialExtensionRequestSchema,
  adminUserStatusRequestSchema,
  adminUserDirectoryFilterSchema,
  adminUserNoteRequestSchema,
  adminUserSessionRevokeRequestSchema,
  adminVenueActionRequestSchema,
  dateOnlySchema,
  platformSettingsUpdateRequestSchema,
} from "@leaguekick/contracts";
import { Router } from "express";
import {rateLimit} from "express-rate-limit";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";
import type { CommercialService } from "./commercial.service.js";

const pageQuerySchema=z.object({
  q:z.string().trim().max(100).optional(),
  page:z.coerce.number().int().min(1).max(100000).default(1),
  pageSize:z.coerce.number().int().min(10).max(100).default(25),
  sort:z.enum(["newest","oldest"]).default("newest"),
});
const userPageQuerySchema=pageQuerySchema.merge(adminUserDirectoryFilterSchema);
const userIdSchema=z.string().uuid();
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export function createOwnerCommercialRouter(service: CommercialService, tokens: TokenService) {
  const router = Router();
  router.use(requireAuth(tokens), requireRole("VENUE_OWNER"));

  router.get("/subscription", async (request, response, next) => {
    try {
      response.json(await service.ownerBilling(request.auth!.userId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/subscription/reactivation-request", async (request, response, next) => {
    try {
      await service.requestReactivation(request.auth!.userId);
      response.status(202).json({ requested: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/analytics", async (request, response, next) => {
    try {
      const from = dateOnlySchema.parse(request.query.from);
      const to = dateOnlySchema.parse(request.query.to);
      response.json(await service.ownerAnalytics(request.auth!.userId, from, to));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createAdminRouter(service: CommercialService, tokens: TokenService) {
  const router = Router();
  router.use(requireAuth(tokens), requireRole("PLATFORM_ADMIN"));
  router.use((_request,response,next)=>{
    response.setHeader("Cache-Control","no-store");
    next();
  });
  const exportLimiter=rateLimit({windowMs:60_000,limit:5,
    standardHeaders:"draft-8",legacyHeaders:false});

  // A bounded period request returns aggregate counts only; role-gated at router level.
  router.get("/analytics",async(request,response,next)=>{
    try{
      const days=adminAnalyticsDaysSchema.parse(request.query.days??30) as 7|30|90|365;
      response.json(await service.adminAnalytics(days));
    }catch(error){next(error);}
  });

  router.get("/dashboard", async (_request, response, next) => {
    try {
      response.json(await service.adminDashboard());
    } catch (error) {
      next(error);
    }
  });

  // Phase 5: financial oversight. Sources are manually recorded subscription
  // receipts, not bookings GMV or processor-verified revenue.
  router.get("/billing/receipts",async(request,response,next)=>{
    try{response.json(await service.billingReceipts(adminBillingFiltersSchema.parse(request.query)));}
    catch(error){next(error);}
  });
  router.get("/billing/summary",async(request,response,next)=>{
    try{response.json(await service.billingSummary(adminBillingFiltersSchema.parse(request.query)));}
    catch(error){next(error);}
  });
  router.post("/billing/paid-receipts/:id/void",async(request,response,next)=>{
    try{
      const id=userIdSchema.parse(request.params.id);
      const {reason}=reasonSchema.parse(request.body);
      await service.voidPaidReceipt(request.auth!.userId,id,reason);
      response.json({voided:true});
    }catch(error){next(error);}
  });

  // Phase 4: read-only monitoring, plus separately audited investigation records.
  router.get("/operations/venues/duplicates",async(_request,response,next)=>{
    try{response.json(await service.operationDuplicates());}catch(error){next(error);}
  });
  router.get("/operations/:kind",async(request,response,next)=>{
    try{
      const kind=adminOperationKindSchema.parse(request.params.kind);
      const filters=adminOperationFiltersSchema.parse(request.query);
      response.json(await service.operationsPage(kind,filters));
    }catch(error){next(error);}
  });
  router.get("/operations/:kind/:id",async(request,response,next)=>{
    try{
      const kind=adminOperationKindSchema.parse(request.params.kind);
      response.json({detail:await service.operationDetail(kind,userIdSchema.parse(request.params.id))});
    }catch(error){next(error);}
  });
  router.get("/operations/:kind/:id/cases",async(request,response,next)=>{
    try{
      const kind=adminOperationKindSchema.parse(request.params.kind);
      response.json(await service.targetAdminCases(kind,userIdSchema.parse(request.params.id)));
    }catch(error){next(error);}
  });
  router.get("/cases",async(request,response,next)=>{
    try{response.json(await service.adminCases(adminCaseFilterSchema.parse(request.query)));}
    catch(error){next(error);}
  });
  router.post("/cases",async(request,response,next)=>{
    try{
      const input=adminCaseCreateSchema.parse(request.body);
      response.status(201).json(await service.openAdminCase(request.auth!.userId,input));
    }catch(error){next(error);}
  });
  router.patch("/cases/:id",async(request,response,next)=>{
    try{
      const id=userIdSchema.parse(request.params.id);
      response.json(await service.updateAdminCase(request.auth!.userId,id,
        adminCaseUpdateSchema.parse(request.body)));
    }catch(error){next(error);}
  });

  router.get("/users", async (request, response, next) => {
    try {
      const query = typeof request.query.q === "string" ? request.query.q : undefined;
      response.json({ users: await service.listUsers(query) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/users/page",async(request,response,next)=>{
    try{
      const p=userPageQuerySchema.parse(request.query);
      response.json(await service.listUsersPage(p.q,p.page,p.pageSize,p.sort,{status:p.status,role:p.role,city:p.city}));
    }catch(error){next(error);}
  });

  router.get("/users/:userId",async(request,response,next)=>{
    try{
      response.json({detail:await service.adminUserDetail(userIdSchema.parse(request.params.userId))});
    }catch(error){next(error);}
  });

  router.post("/users/:userId/revoke-sessions",async(request,response,next)=>{
    try{
      const userId=userIdSchema.parse(request.params.userId);
      const {reason}=adminUserSessionRevokeRequestSchema.parse(request.body);
      await service.revokeUserSessions(request.auth!.userId,userId,reason);
      response.json({revoked:true});
    }catch(error){next(error);}
  });

  router.post("/users/:userId/notes",async(request,response,next)=>{
    try{
      const userId=userIdSchema.parse(request.params.userId);
      const {note,reason}=adminUserNoteRequestSchema.parse(request.body);
      await service.addUserNote(request.auth!.userId,userId,note,reason);
      response.status(201).json({created:true});
    }catch(error){next(error);}
  });

  router.patch("/users/:userId/status", async (request, response, next) => {
    try {
      const input = adminUserStatusRequestSchema.parse(request.body);
      await service.setUserStatus(request.auth!.userId, userIdSchema.parse(request.params.userId), input);
      response.json({ updated: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/venues", async (request, response, next) => {
    try {
      const query = typeof request.query.q === "string" ? request.query.q : undefined;
      response.json({ venues: await service.listVenues(query) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/venues/page",async(request,response,next)=>{
    try{
      const p=pageQuerySchema.parse(request.query);
      response.json(await service.listVenuesPage(p.q,p.page,p.pageSize,p.sort));
    }catch(error){next(error);}
  });

  router.get("/venues/duplicates", async (_request, response, next) => {
    try {
      response.json({ groups: await service.duplicateVenues() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/venues/:venueId/action", async (request, response, next) => {
    try {
      const input = adminVenueActionRequestSchema.parse(request.body);
      await service.applyVenueAction(request.auth!.userId, request.params.venueId!, input);
      response.json({ updated: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/venues/:venueId/payments", async (request, response, next) => {
    try {
      response.json({ payments: await service.venuePayments(request.params.venueId!) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/venues/:venueId/subscription/activate", async (request, response, next) => {
    try {
      const input = adminSubscriptionActivationRequestSchema.parse(request.body);
      await service.activateSubscription(request.auth!.userId, request.params.venueId!, input);
      response.status(201).json({ activated: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/venues/:venueId/trial/extend", async (request, response, next) => {
    try {
      const input = adminTrialExtensionRequestSchema.parse(request.body);
      await service.extendTrial(request.auth!.userId, request.params.venueId!, input);
      response.json({ extended: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/settings", async (_request, response, next) => {
    try {
      response.json({ settings: await service.settings() });
    } catch (error) {
      next(error);
    }
  });

  router.put("/settings", async (request, response, next) => {
    try {
      const input = platformSettingsUpdateRequestSchema.parse(request.body);
      response.json({ settings: await service.updateSettings(request.auth!.userId, input) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/audit/page",async(request,response,next)=>{
    try{response.json(await service.auditPage(adminAuditFilterSchema.parse(request.query)));}
    catch(error){next(error);}
  });
  router.get("/audit/export",exportLimiter,async(request,response,next)=>{
    try{
      const csv=await service.auditCsv(adminAuditFilterSchema.parse(request.query));
      response.setHeader("Content-Type","text/csv; charset=utf-8");
      response.setHeader("Content-Disposition",'attachment; filename="futsal-admin-audit.csv"');
      response.setHeader("Cache-Control","no-store");
      response.status(200).send(csv);
    }catch(error){next(error);}
  });
  router.get("/diagnostics",async(_request,response,next)=>{
    try{
      response.setHeader("Cache-Control","no-store");
      response.json(await service.diagnostics());
    }catch(error){next(error);}
  });

  router.get("/audit", async (_request, response, next) => {
    try {
      response.json({ logs: await service.auditLogs() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/support-notes", async (request, response, next) => {
    try {
      const input = adminSupportNoteRequestSchema.parse(request.body);
      await service.supportNote(request.auth!.userId, input);
      response.status(201).json({ created: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/payments/:paymentId/void", async (request, response, next) => {
    try {
      const { reason } = reasonSchema.parse(request.body);
      await service.voidPayment(request.auth!.userId, request.params.paymentId!, reason);
      response.json({ voided: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/content/posts/:postId/unpublish", async (request, response, next) => {
    try {
      const { reason } = reasonSchema.parse(request.body);
      await service.unpublishPost(request.auth!.userId, request.params.postId!, reason);
      response.json({ unpublished: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/content/promotions/:promotionId/close", async (request, response, next) => {
    try {
      const { reason } = reasonSchema.parse(request.body);
      await service.closePromotion(request.auth!.userId, request.params.promotionId!, reason);
      response.json({ closed: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
