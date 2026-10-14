import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  bookingCancelRequestSchema,
  dateOnlySchema,
  manualBookingRequestSchema,
  onlineBookingRequestSchema,
  venueBlockRequestSchema,
  venueDirectoryFiltersSchema,
  venueReviewCreateSchema,
  venueReviewSortSchema,
  venueSlotWatchCreateSchema,
  venueSavedTimeSchema,
} from "@leaguekick/contracts";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";
import type { BookingService } from "./booking.service.js";

const routeIdSchema = z.string().uuid();

export function createPublicVenueRouter(booking: BookingService) {
  const router = Router();
  router.use(rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: "draft-8", legacyHeaders: false }));

  router.get("/", async (request, response, next) => {
    try {
      const city = typeof request.query.city === "string" ? request.query.city.trim() : undefined;
      const province = typeof request.query.province === "string" ? request.query.province.trim() : undefined;
      const q = typeof request.query.q === "string" ? request.query.q.trim().slice(0,120) : undefined;
      response.json(await booking.listPublicVenues({
        ...(city ? { city } : {}),
        ...(province ? { province } : {}),
        ...(q ? { q } : {}),
      }));
    } catch (error) { next(error); }
  });

  // Expensive availability-aware discovery has an additional per-IP rate limit.
  router.get("/search",rateLimit({windowMs:60_000,limit:24,standardHeaders:"draft-8",legacyHeaders:false}),
    async(request,response,next)=>{
      try{
        const query=request.query;
        const optionalString=(key:string)=>typeof query[key]==="string"?query[key]:undefined;
        const optionalNumber=(key:string)=>query[key]===undefined?undefined:z.coerce.number().parse(query[key]);
        const input=venueDirectoryFiltersSchema.parse({
          date:optionalString("date"),
          ...(optionalString("province")!==undefined?{province:optionalString("province")}:{}),
          ...(optionalString("q")!==undefined?{q:optionalString("q")}:{}),
          ...(optionalString("startTime")!==undefined?{startTime:optionalString("startTime")}:{}),
          ...(optionalString("endTime")!==undefined?{endTime:optionalString("endTime")}:{}),
          ...(query.minPriceAfn!==undefined?{minPriceAfn:optionalNumber("minPriceAfn")}:{}),
          ...(query.maxPriceAfn!==undefined?{maxPriceAfn:optionalNumber("maxPriceAfn")}:{}),
          ...(query.sort!==undefined?{sort:query.sort}:{}),
          ...(query.availableOnly!==undefined?{availableOnly:query.availableOnly==="true"}:{}),
          ...(query.latitude!==undefined?{latitude:optionalNumber("latitude")}:{}),
          ...(query.longitude!==undefined?{longitude:optionalNumber("longitude")}:{}),
        });
        response.json(await booking.searchVenueDirectory(input));
      }catch(error){next(error);}
    });

  router.get("/discovery",async(request,response,next)=>{
    try{
      const q=typeof request.query.q==="string"?request.query.q.trim().slice(0,120):undefined;
      const province=typeof request.query.province==="string"?request.query.province.trim().slice(0,80):undefined;
      response.json(await booking.venueDiscovery({...(q?{q}:{}),...(province?{province}:{})}));
    }catch(error){next(error);}
  });

  router.get("/nearby",async(request,response,next)=>{
    try{
      const latitude=z.coerce.number().finite().min(-90).max(90).parse(request.query.latitude);
      const longitude=z.coerce.number().finite().min(-180).max(180).parse(request.query.longitude);
      response.json(await booking.nearbyVenues(latitude,longitude));
    }catch(error){next(error);}
  });

  router.get("/:venueId", async (request, response, next) => {
    try { response.json({ venue: await booking.getPublicVenue(routeIdSchema.parse(request.params.venueId)) }); }
    catch (error) { next(error); }
  });

  router.get("/:venueId/reviews",async(request,response,next)=>{
    try{
      const page=z.coerce.number().int().min(1).max(500).default(1).parse(request.query.page);
      const sort=venueReviewSortSchema.default("recent").parse(request.query.sort);
      response.json(await booking.venueReviews(routeIdSchema.parse(request.params.venueId),page,sort));
    }catch(error){next(error);}
  });

  router.get("/:venueId/availability", async (request, response, next) => {
    try {
      const date = dateOnlySchema.parse(request.query.date);
      response.json(await booking.getAvailability(routeIdSchema.parse(request.params.venueId), date));
    } catch (error) { next(error); }
  });

  return router;
}

export function createPlayerBookingRouter(booking: BookingService, tokens: TokenService) {
  const router = Router();
  router.use(requireAuth(tokens));
  const writeLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });

  router.get("/me", async (request, response, next) => {
    try { response.json(await booking.listPlayerBookings(request.auth!.userId)); }
    catch (error) { next(error); }
  });

  router.get("/reviews/mine",async(request,response,next)=>{
    try{
      const venueId=routeIdSchema.parse(request.query.venueId);
      response.json(await booking.myReviewedVenueBookings(request.auth!.userId,venueId));
    }catch(error){next(error);}
  });

  router.post("/reviews",writeLimiter,async(request,response,next)=>{
    try{const input=venueReviewCreateSchema.parse(request.body);
      response.status(201).json({review:await booking.submitVenueReview(request.auth!.userId,input)});
    }catch(error){next(error);}
  });
  router.get("/venue-preferences/:venueId",async(request,response,next)=>{
    try{response.json(await booking.savedVenueTime(request.auth!.userId,
      routeIdSchema.parse(request.params.venueId)));
    }catch(error){next(error);}
  });
  router.put("/venue-preferences/:venueId",writeLimiter,async(request,response,next)=>{
    try{
      const value=request.body?.preferredStart===null?null:
        venueSavedTimeSchema.pick({preferredStart:true}).parse(request.body).preferredStart;
      response.json(await booking.updateSavedVenueTime(request.auth!.userId,
        routeIdSchema.parse(request.params.venueId),value));
    }catch(error){next(error);}
  });
  router.get("/slot-watches",async(request,response,next)=>{
    try{response.json(await booking.myVenueSlotWatches(request.auth!.userId,
      routeIdSchema.parse(request.query.venueId)));
    }catch(error){next(error);}
  });
  router.post("/slot-watches",writeLimiter,async(request,response,next)=>{
    try{response.status(201).json({watch:await booking.watchUnavailableSlot(request.auth!.userId,
      venueSlotWatchCreateSchema.parse(request.body))});
    }catch(error){next(error);}
  });
  router.delete("/slot-watches/:watchId",writeLimiter,async(request,response,next)=>{
    try{response.json(await booking.removeVenueSlotWatch(request.auth!.userId,
      routeIdSchema.parse(request.params.watchId)));
    }catch(error){next(error);}
  });

  router.post("/", writeLimiter, async (request, response, next) => {
    try {
      const input = onlineBookingRequestSchema.parse(request.body);
      response.status(201).json({ booking: await booking.createOnlineBooking(request.auth!.userId, input) });
    } catch (error) { next(error); }
  });

  router.post("/:bookingId/cancel", writeLimiter, async (request, response, next) => {
    try {
      const input = bookingCancelRequestSchema.parse(request.body ?? {});
      response.json({ booking: await booking.cancelPlayerBooking(request.auth!.userId, routeIdSchema.parse(request.params.bookingId), input.reason) });
    } catch (error) { next(error); }
  });

  return router;
}

export function createOwnerScheduleRouter(booking: BookingService, tokens: TokenService) {
  const router = Router();
  router.use(requireAuth(tokens), requireRole("VENUE_OWNER"));
  const writeLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false });

  router.get("/schedule", async (request, response, next) => {
    try {
      const date = dateOnlySchema.parse(request.query.date);
      response.json(await booking.getOwnerSchedule(request.auth!.userId, date));
    } catch (error) { next(error); }
  });

  router.get("/bookings/pending",async(request,response,next)=>{
    try{response.json(await booking.getOwnerPendingBookings(request.auth!.userId));}
    catch(error){next(error);}
  });

  router.post("/bookings/manual", writeLimiter, async (request, response, next) => {
    try {
      const input = manualBookingRequestSchema.parse(request.body);
      response.status(201).json({ booking: await booking.createManualBooking(request.auth!.userId, input) });
    } catch (error) { next(error); }
  });

  router.post("/blocks", writeLimiter, async (request, response, next) => {
    try {
      const input = venueBlockRequestSchema.parse(request.body);
      response.status(201).json({ block: await booking.createBlock(request.auth!.userId, input) });
    } catch (error) { next(error); }
  });

  router.put("/blocks/:blockId", writeLimiter, async (request, response, next) => {
    try {
      const input = venueBlockRequestSchema.parse(request.body);
      response.json({ block: await booking.updateBlock(
        request.auth!.userId,
        routeIdSchema.parse(request.params.blockId),
        input,
      ) });
    } catch (error) { next(error); }
  });

  router.delete("/blocks/:blockId", writeLimiter, async (request, response, next) => {
    try {
      await booking.deleteBlock(request.auth!.userId, routeIdSchema.parse(request.params.blockId));
      response.status(204).send();
    } catch (error) { next(error); }
  });

  router.post("/bookings/:bookingId/confirm", writeLimiter, async (request,response,next)=>{
    try{
      response.json({booking:await booking.confirmOwnerBooking(
        request.auth!.userId,
        routeIdSchema.parse(request.params.bookingId),
      )});
    }catch(error){next(error);}
  });

  router.post("/bookings/:bookingId/cancel", writeLimiter, async (request, response, next) => {
    try {
      const input = bookingCancelRequestSchema.parse(request.body ?? {});
      response.json({ booking: await booking.cancelOwnerBooking(request.auth!.userId, routeIdSchema.parse(request.params.bookingId), input.reason) });
    } catch (error) { next(error); }
  });

  return router;
}
