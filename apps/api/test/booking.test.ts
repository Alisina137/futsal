import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { BookingService } from "../src/modules/booking/booking.service.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";
import { FakeBookingRepository } from "./fake-booking-repository.js";

function setup() {
  const authRepository = new FakeAuthRepository();
  const bookingRepository = new FakeBookingRepository();
  const tokens = new TokenService("test-secret-that-is-longer-than-thirty-two-characters", "test", "test-mobile");
  const auth = new AuthService(authRepository, tokens);
  const clock = { now: new Date("2026-10-04T00:00:00.000Z") };
  const booking = new BookingService(bookingRepository, () => clock.now);
  const app = createApp({ authService: auth, tokenService: tokens, bookingService: booking });
  return { app, bookingRepository, authRepository, clock };
}

async function register(
  app: ReturnType<typeof createApp>,
  authRepository: FakeAuthRepository,
  role: "PLAYER" | "VENUE_OWNER",
  phone: string,
) {
  const username = `u${phone.replace(/\D/g, "").slice(-10)}`;
  const registration = await request(app).post("/api/v1/auth/register").send({
    username,
    phone,
    password: "strong-pass-3!",
    confirmPassword: "strong-pass-3!",
    preferredLanguage: "fa-AF",
  });
  expect(registration.status).toBe(201);

  // "PLAYER" represents the free base-account player experience: no global role
  // is activated. Venue Owner remains a paid management entitlement.
  if (role === "PLAYER") return registration;

  await authRepository.activateRoleSubscription({
    actorUserId: registration.body.user.id,
    userId: registration.body.user.id,
    role: "VENUE_OWNER",
    monthlyPriceAfn: 1000,
    months: 1,
    paymentReference: "test-paid",
    now: new Date("2026-10-04T00:00:00.000Z"),
  });

  const refreshed = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken: registration.body.refreshToken });
  expect(refreshed.status).toBe(200);
  expect(refreshed.body.user.roles).toContain("VENUE_OWNER");
  return refreshed;
}

describe("Phase 3 availability and booking API", () => {
  it("publishes actual venue About facts and paginates verified ratings without identity leakage",async()=>{
    const {app,bookingRepository,authRepository}=setup();
    const owner=await register(app,authRepository,"VENUE_OWNER","0709980394");
    const {venue}=bookingRepository.seedVenue(owner.body.user.id);
    venue.verificationStatus="VERIFIED";
    venue.amenities=["LIGHTING","PARKING"];
    venue.houseRules="Clean indoor shoes required.";
    const publicVenue=await request(app).get(`/api/v1/venues/${venue.id}`);
    expect(publicVenue.status).toBe(200);
    expect(publicVenue.body.venue.verificationStatus).toBe("VERIFIED");
    expect(publicVenue.body.venue.amenities).toEqual(["LIGHTING","PARKING"]);
    expect(publicVenue.body.venue.houseRules).toBe("Clean indoor shoes required.");
    expect(publicVenue.body.venue.openingHours).toHaveLength(7);
    expect(publicVenue.body.venue.openingHours[0].opensAt).toBe("08:00");
    expect(publicVenue.body.venue.areas[0].basePriceAfn).toBe(1800);
    expect(JSON.stringify(publicVenue.body)).not.toContain(owner.body.user.id);

    for(let i=0;i<25;i++){
      const id="00000000-0000-4000-a000-"+String(i+1).padStart(12,"0");
      bookingRepository.reviews.set("booking-"+i,{
        id,venueId:venue.id,rating:i%5+1,body:"Public review "+i,
        createdAt:new Date(Date.UTC(2026,9,2,0,i,0)).toISOString(),verified:true,
      });
    }
    const first=await request(app).get(`/api/v1/venues/${venue.id}/reviews`)
      .query({page:1,sort:"highest"});
    const second=await request(app).get(`/api/v1/venues/${venue.id}/reviews`)
      .query({page:2,sort:"highest"});
    expect(first.status).toBe(200);
    expect(first.body.reviewCount).toBe(25);
    expect(first.body.ratingCounts).toEqual([5,5,5,5,5]);
    expect(first.body.reviews).toHaveLength(20);
    expect(first.body.hasMore).toBe(true);
    expect(second.body.reviews).toHaveLength(5);
    expect(second.body.hasMore).toBe(false);
    expect(first.body.reviews[0].rating).toBe(5);
    expect(second.body.reviews.every((review:{rating:number})=>review.rating===1)).toBe(true);
    expect((await request(app).get(`/api/v1/venues/${venue.id}/reviews`)
      .query({page:0})).status).toBe(400);
    expect((await request(app).get(`/api/v1/venues/${venue.id}/reviews`)
      .query({sort:"invalid"})).status).toBe(400);
    expect(JSON.stringify(first.body)).not.toContain(owner.body.user.id);
  });

  it("returns the nearest ten permitted venues with saved map pins, excluding expired and suspended venues",async()=>{
    const {app,bookingRepository,authRepository,clock}=setup();
    const owner=await register(app,authRepository,"VENUE_OWNER","0705556601");
    const ids:string[]=[];
    for(let i=0;i<13;i++){
      const {venue}=bookingRepository.seedVenue(owner.body.user.id);
      venue.name=`Court ${i}`;
      venue.latitude=34.52+i*0.01;
      venue.longitude=69.17;
      ids.push(venue.id);
    }
    const noPin=bookingRepository.seedVenue(owner.body.user.id).venue;
    const expired=bookingRepository.seedVenue(owner.body.user.id,{trialEndsAt:new Date(clock.now.getTime()-1)}).venue;
    expired.latitude=34.519;expired.longitude=69.17;
    const suspended=bookingRepository.seedVenue(owner.body.user.id,{status:"SUSPENDED"}).venue;
    suspended.latitude=34.519;suspended.longitude=69.17;

    const response=await request(app).get("/api/v1/venues/nearby").query({latitude:34.52,longitude:69.17});
    expect(response.status).toBe(200);
    expect(response.body.venues).toHaveLength(10);
    expect(response.body.venues[0].id).toBe(ids[0]);
    expect(response.body.venues[0].distanceKm).toBeCloseTo(0,5);
    const venueIds=response.body.venues.map((venue:{id:string})=>venue.id);
    expect(venueIds).not.toContain(noPin.id);
    expect(venueIds).not.toContain(expired.id);
    expect(venueIds).not.toContain(suspended.id);
    const distances=response.body.venues.map((venue:{distanceKm:number})=>venue.distanceKm);
    expect(distances).toEqual([...distances].sort((a,b)=>a-b));
    expect((await request(app).get("/api/v1/venues/nearby").query({latitude:90.01,longitude:30})).status).toBe(400);
    expect((await request(app).get("/api/v1/venues/nearby").query({latitude:"bad",longitude:30})).status).toBe(400);
    expect((await request(app).get("/api/v1/venues/nearby").query({latitude:34.52})).status).toBe(400);
  });

  it("lists provinces dynamically from active subscribed venues and suggests matching venues or locations",async()=>{
    const {app,bookingRepository,authRepository,clock}=setup();
    const owner=await register(app,authRepository,"VENUE_OWNER","0708777781");
    const ownerId=owner.body.user.id;
    const kabul=bookingRepository.seedVenue(ownerId).venue;
    kabul.name="Kabul Star Arena";
    kabul.address="Kart-e Se, Kabul";
    const herat=bookingRepository.seedVenue(ownerId).venue;
    herat.name="Herat Sport Club";herat.province="Herat";
    herat.city="Herat";herat.address="Jada-e Malek, Herat";
    const hidden=bookingRepository.seedVenue(ownerId,{status:"SUSPENDED"}).venue;
    hidden.name="Hidden Kandahar";hidden.province="Kandahar";
    const expired=bookingRepository.seedVenue(ownerId,{
      trialEndsAt:new Date(clock.now.getTime()-1),
    }).venue;
    expired.name="Expired Balkh";expired.province="Balkh";

    const opts=await request(app).get("/api/v1/venues/discovery");
    expect(opts.status).toBe(200);
    expect(opts.body.provinces).toEqual(["Herat","Kabul"]);
    expect(opts.body.suggestions).toEqual([]);

    const names=await request(app).get("/api/v1/venues/discovery").query({q:"star"});
    expect(names.status).toBe(200);
    expect(names.body.suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({kind:"VENUE",label:"Kabul Star Arena",query:"Kabul Star Arena"})
    ]));
    const byCity=await request(app).get("/api/v1/venues/discovery").query({q:"Her",province:"Herat"});
    expect(byCity.status).toBe(200);
    expect(byCity.body.suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({kind:"LOCATION",label:"Herat",query:"Herat"})
    ]));
    const scoped=await request(app).get("/api/v1/venues/discovery").query({q:"Kabul",province:"Herat"});
    expect(scoped.status).toBe(200);
    expect(scoped.body.suggestions).toEqual([]);
    expect(scoped.body.provinces).toEqual(["Herat","Kabul"]);

    const nameResults=await request(app).get("/api/v1/venues").query({q:"star"});
    expect(nameResults.status).toBe(200);
    expect(nameResults.body.venues.map((venue:{id:string})=>venue.id)).toEqual([kabul.id]);
    const addressResults=await request(app).get("/api/v1/venues").query({q:"Kart-e"});
    expect(addressResults.status).toBe(200);
    expect(addressResults.body.venues.map((venue:{id:string})=>venue.id)).toEqual([kabul.id]);
    const cityResults=await request(app).get("/api/v1/venues").query({q:"herat"});
    expect(cityResults.status).toBe(200);
    expect(cityResults.body.venues.map((venue:{id:string})=>venue.id)).toEqual([herat.id]);
    const provinceResults=await request(app).get("/api/v1/venues").query({province:"Herat"});
    expect(provinceResults.status).toBe(200);
    expect(provinceResults.body.venues.map((venue:{id:string})=>venue.id)).toEqual([herat.id]);
    const noResults=await request(app).get("/api/v1/venues").query({province:"Herat",q:"Kabul"});
    expect(noResults.status).toBe(200);
    expect(noResults.body.venues).toEqual([]);

    const searchMeta=await request(app).get("/api/v1/venues/discovery").query({q:"a"});
    expect(searchMeta.body.suggestions.length).toBeLessThanOrEqual(8);
    expect(searchMeta.body.suggestions.every((x:{label:string})=>!x.label.includes("Hidden"))).toBe(true);
  });

  it("filters and sorts venues against real date-scoped availability",async()=>{
    const {app,bookingRepository,authRepository}=setup();
    const owner=await register(app,authRepository,"VENUE_OWNER","0709776674");
    const a=bookingRepository.seedVenue(owner.body.user.id).venue;
    a.name="Budget Futsal";a.areas[0]!.basePriceAfn=700;
    a.latitude=34.5200;a.longitude=69.1700;
    const b=bookingRepository.seedVenue(owner.body.user.id).venue;
    b.name="Premium Futsal";b.areas[0]!.basePriceAfn=2500;
    b.latitude=34.6000;b.longitude=69.1700;
    const closed=bookingRepository.seedVenue(owner.body.user.id).venue;
    closed.name="Closed Futsal";
    closed.openingHours=closed.openingHours.map(h=>({...h,isClosed:true,opensAt:null,closesAt:null}));
    const paused=bookingRepository.seedVenue(owner.body.user.id).venue;
    paused.name="Paused Futsal";paused.onlineBookingEnabled=false;
    const suspended=bookingRepository.seedVenue(owner.body.user.id,{status:"SUSPENDED"}).venue;
    suspended.name="Hidden";
    bookingRepository.followerCounts.set(b.id,12);
    bookingRepository.followerCounts.set(a.id,3);

    const route="/api/v1/venues/search";
    const all=await request(app).get(route).query({date:"2026-10-05"});
    expect(all.status).toBe(200);
    expect(all.body.results).toHaveLength(4);
    expect(all.body.results.map((v:{venue:{id:string}})=>v.venue.id)).not.toContain(suspended.id);
    const unavailable=all.body.results.find((v:{venue:{id:string}})=>v.venue.id===closed.id);
    expect(unavailable.availableCount).toBe(0);
    expect(unavailable.lowestPriceAfn).toBeNull();
    expect(unavailable.nextSlots).toEqual([]);

    const only=await request(app).get(route).query({date:"2026-10-05",availableOnly:"true",sort:"lowestPrice"});
    expect(only.status).toBe(200);
    expect(only.body.results.map((v:{venue:{id:string}})=>v.venue.id)).toEqual([a.id,b.id]);
    expect(only.body.results[0].lowestPriceAfn).toBe(700);
    expect(only.body.results[1].lowestPriceAfn).toBe(2500);
    // The exact preview slots must be a subset of the same live filtered result.
    expect(only.body.results[0].nextSlots).toHaveLength(3);
    expect(only.body.results[0].nextSlots.every((slot:{priceAfn:number;venueId:string})=>
      slot.priceAfn===700&&slot.venueId===a.id)).toBe(true);
    const startTimes=only.body.results[0].nextSlots.map((slot:{startsAt:string})=>slot.startsAt);
    expect(startTimes).toEqual([...startTimes].sort());
    expect(only.body.results[0].availableCount).toBeGreaterThan(3);
    const upper=await request(app).get(route).query({date:"2026-10-05",maxPriceAfn:1000});
    expect(upper.body.results.map((v:{venue:{id:string}})=>v.venue.id)).toEqual([a.id]);
    const morning=await request(app).get(route).query({date:"2026-10-05",startTime:"07:00",endTime:"09:00",availableOnly:"true"});
    expect(morning.status).toBe(200);
    expect(morning.body.results.length).toBe(2);
    expect(morning.body.results.every((v:{availableCount:number})=>v.availableCount>0)).toBe(true);
    const morningPreview=morning.body.results[0].nextSlots;
    expect(morningPreview.length).toBeGreaterThan(0);
    expect(morningPreview.length).toBeLessThanOrEqual(3);
    const noHours=await request(app).get(route).query({date:"2026-10-05",startTime:"00:00",endTime:"05:59",availableOnly:"true"});
    expect(noHours.body.results).toEqual([]);
    const followers=await request(app).get(route).query({date:"2026-10-05",sort:"mostFollowed"});
    expect(followers.body.results[0].venue.id).toBe(b.id);
    const nearest=await request(app).get(route).query({date:"2026-10-05",sort:"nearest",latitude:34.5201,longitude:69.17});
    expect(nearest.body.results[0].venue.id).toBe(a.id);
    expect(nearest.body.results[0].distanceKm).toBeLessThan(1);
    const malformed=await request(app).get(route).query({date:"2026-10-05",startTime:"25:99"});
    expect(malformed.status).toBe(400);
    const wrongRange=await request(app).get(route).query({date:"2026-10-05",minPriceAfn:3000,maxPriceAfn:400});
    expect(wrongRange.status).toBe(400);
    const oldDate=await request(app).get(route).query({date:"2026-10-03"});
    expect(oldDate.status).toBe(400);

    // Tapping a preview does not book. The real booking changes inventory only
    // when a separate authenticated confirmation request is submitted.
    expect(bookingRepository.bookings.size).toBe(0);
    const player=await register(app,authRepository,"PLAYER","0709776675");
    const first=only.body.results[0].nextSlots[0];
    const booked=await request(app).post("/api/v1/bookings")
      .set("Authorization",`Bearer ${player.body.accessToken}`).send({
        areaId:first.areaId,startsAt:first.startsAt,
        idempotencyKey:"preview-phase3-booking-confirm",
      });
    expect(booked.status).toBe(201);
    const after=await request(app).get(route).query({date:"2026-10-05",maxPriceAfn:1000});
    const updated=after.body.results.find((row:{venue:{id:string}})=>row.venue.id===a.id);
    expect(updated.availableCount).toBe(only.body.results[0].availableCount-1);
    expect(updated.nextSlots.some((slot:{areaId:string;startsAt:string})=>
      slot.areaId===first.areaId&&slot.startsAt===first.startsAt)).toBe(false);
  });

  it("previews actual promotion prices without inventing extra slots",async()=>{
    const {app,bookingRepository,authRepository}=setup();
    const owner=await register(app,authRepository,"VENUE_OWNER","0709776676");
    const {venue}=bookingRepository.seedVenue(owner.body.user.id);
    const live=await request(app).get(`/api/v1/venues/${venue.id}/availability`)
      .query({date:"2026-10-05"});
    expect(live.status).toBe(200);
    const first=live.body.slots[0];
    const id="44444444-4444-4444-8444-444444444444";
    bookingRepository.promotionPrices.push({
      id,areaId:first.areaId,startsAt:new Date(first.startsAt),
      endsAt:new Date(first.endsAt),discountedPriceAfn:900,
    });
    const found=await request(app).get("/api/v1/venues/search")
      .query({date:"2026-10-05",maxPriceAfn:900,availableOnly:"true"});
    expect(found.status).toBe(200);
    expect(found.body.results).toHaveLength(1);
    expect(found.body.results[0].availableCount).toBe(1);
    expect(found.body.results[0].lowestPriceAfn).toBe(900);
    expect(found.body.results[0].nextSlots).toEqual([
      expect.objectContaining({
        venueId:venue.id,areaId:first.areaId,startsAt:first.startsAt,
        endsAt:first.endsAt,promotionId:id,priceAfn:900,originalPriceAfn:1800,
      }),
    ]);
  });

  it("accepts one verified review after a confirmed online booking ends and keeps identities private",async()=>{
    const {app,bookingRepository,authRepository,clock}=setup();
    const owner=await register(app,authRepository,"VENUE_OWNER","0709980021");
    const player=await register(app,authRepository,"PLAYER","0709980022");
    const outsider=await register(app,authRepository,"PLAYER","0709980023");
    const venue=bookingRepository.seedVenue(owner.body.user.id).venue;
    const date="2026-10-05";
    const available=await request(app).get(`/api/v1/venues/${venue.id}/availability`).query({date});
    const first=available.body.slots[0];
    const booking=await request(app).post("/api/v1/bookings")
      .set("Authorization",`Bearer ${player.body.accessToken}`)
      .send({areaId:first.areaId,startsAt:first.startsAt,idempotencyKey:"review-proof-01"});
    expect(booking.status).toBe(201);
    const input={bookingId:booking.body.booking.id,rating:5,body:"Reliable court"};
    const early=await request(app).post("/api/v1/bookings/reviews")
      .set("Authorization",`Bearer ${player.body.accessToken}`).send(input);
    expect(early.status).toBe(403);
    clock.now=new Date("2026-10-06T08:00:00.000Z");
    const fake=await request(app).post("/api/v1/bookings/reviews")
      .set("Authorization",`Bearer ${outsider.body.accessToken}`).send(input);
    expect(fake.status).toBe(403);
    const created=await request(app).post("/api/v1/bookings/reviews")
      .set("Authorization",`Bearer ${player.body.accessToken}`).send(input);
    expect(created.status).toBe(201);
    expect(created.body.review).toEqual(expect.objectContaining({
      venueId:venue.id,rating:5,verified:true,body:"Reliable court",
    }));
    // Every completed reviewed booking is listed only to its authenticated owner,
    // even after it falls beyond the public reviews page window.
    const privateMine=await request(app).get("/api/v1/bookings/reviews/mine")
      .set("Authorization",`Bearer ${player.body.accessToken}`).query({venueId:venue.id});
    expect(privateMine.status).toBe(200);
    expect(privateMine.body.reviewedBookingIds).toEqual([booking.body.booking.id]);
    const otherReviews=await request(app).get("/api/v1/bookings/reviews/mine")
      .set("Authorization",`Bearer ${outsider.body.accessToken}`).query({venueId:venue.id});
    expect(otherReviews.body.reviewedBookingIds).toEqual([]);
    expect((await request(app).get("/api/v1/bookings/reviews/mine")
      .query({venueId:venue.id})).status).toBe(401);
    const duplicate=await request(app).post("/api/v1/bookings/reviews")
      .set("Authorization",`Bearer ${player.body.accessToken}`).send(input);
    expect(duplicate.status).toBe(400);
    const listing=await request(app).get(`/api/v1/venues/${venue.id}/reviews`);
    expect(listing.status).toBe(200);
    expect(listing.body.averageRating).toBe(5);
    expect(listing.body.reviewCount).toBe(1);
    expect(listing.body.reviews).toHaveLength(1);
    expect(JSON.stringify(listing.body)).not.toContain(booking.body.booking.id);
    expect(JSON.stringify(created.body.review)).not.toContain(booking.body.booking.id);
    expect(JSON.stringify(listing.body)).not.toContain(player.body.user.id);
    expect(JSON.stringify(listing.body)).not.toContain(player.body.user.phone);
  });

  it("persists per-user favorite times and guards exact reserved-slot alerts",async()=>{
    const {app,bookingRepository,authRepository,clock}=setup();
    const owner=await register(app,authRepository,"VENUE_OWNER","0709980031");
    const player=await register(app,authRepository,"PLAYER","0709980032");
    const watcher=await register(app,authRepository,"PLAYER","0709980033");
    const {venue}=bookingRepository.seedVenue(owner.body.user.id);
    const pref=`/api/v1/bookings/venue-preferences/${venue.id}`;
    const token=watcher.body.accessToken;
    expect((await request(app).get(pref).set("Authorization",`Bearer ${token}`)).body.preferredStart).toBeNull();
    expect((await request(app).put(pref).set("Authorization",`Bearer ${token}`)
      .send({preferredStart:"18:30"})).status).toBe(200);
    expect((await request(app).get(pref).set("Authorization",`Bearer ${token}`)).body.preferredStart).toBe("18:30");
    expect((await request(app).get(pref)
      .set("Authorization",`Bearer ${player.body.accessToken}`)).body.preferredStart).toBeNull();
    expect((await request(app).put(pref).set("Authorization",`Bearer ${token}`)
      .send({preferredStart:"27:40"})).status).toBe(400);
    const slot=(await request(app).get(`/api/v1/venues/${venue.id}/availability`)
      .query({date:"2026-10-05"})).body.slots[0];
    const watchRoute="/api/v1/bookings/slot-watches";
    const slotInput={venueId:venue.id,areaId:slot.areaId,startsAt:slot.startsAt};
    const otherSlot=(await request(app).get(`/api/v1/venues/${venue.id}/availability`)
      .query({date:"2026-10-05"})).body.slots[1];
    const maintenance=await request(app).post("/api/v1/owner/blocks")
      .set("Authorization",`Bearer ${owner.body.accessToken}`)
      .send({areaId:otherSlot.areaId,startsAt:otherSlot.startsAt,
        endsAt:otherSlot.endsAt,reason:"Routine cleaning"});
    expect(maintenance.status).toBe(201);
    // An owner block also appears UNAVAILABLE in the public timetable but is
    // not an actual booking that can trigger an exact cancellation alert.
    const watchingBlock=await request(app).post(watchRoute)
      .set("Authorization",`Bearer ${token}`).send({
        venueId:venue.id,areaId:otherSlot.areaId,startsAt:otherSlot.startsAt,
      });
    expect(watchingBlock.status).toBe(400);
    expect(watchingBlock.body.error.code).toBe("SLOT_WATCH_INVALID");
    expect((await request(app).post(watchRoute).set("Authorization",`Bearer ${token}`)
      .send(slotInput)).status).toBe(400); // Still free: watching is not permitted
    const booked=await request(app).post("/api/v1/bookings")
      .set("Authorization",`Bearer ${player.body.accessToken}`)
      .send({areaId:slot.areaId,startsAt:slot.startsAt,idempotencyKey:"watch-booking-001"});
    expect(booked.status).toBe(201);
    const watched=await request(app).post(watchRoute)
      .set("Authorization",`Bearer ${token}`).send(slotInput);
    expect(watched.status).toBe(201);
    expect(watched.body.watch).toEqual(expect.objectContaining(slotInput));
    const repeat=await request(app).post(watchRoute)
      .set("Authorization",`Bearer ${token}`).send(slotInput);
    expect(repeat.body.watch.id).toBe(watched.body.watch.id);
    const mine=await request(app).get(watchRoute).query({venueId:venue.id})
      .set("Authorization",`Bearer ${token}`);
    expect(mine.body.watches).toHaveLength(1);
    const other=await request(app).delete(watchRoute+"/"+watched.body.watch.id)
      .set("Authorization",`Bearer ${player.body.accessToken}`);
    expect(other.body.removed).toBe(false);

    // Inject a real publisher into the same repository to simulate cancellation.
    const sent:Array<{userId:string;watchId:string}>=[];
    const svc=new BookingService(bookingRepository,()=>clock.now,{
      slotAvailable:async(input:{userId:string;watchId:string})=>{sent.push({userId:input.userId,watchId:input.watchId});},
    } as unknown as import("../src/modules/notifications/notification.types.js").NotificationPublisher);
    const cancelled=await svc.cancelOwnerBooking(owner.body.user.id,booked.body.booking.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(sent).toEqual([{userId:watcher.body.user.id,watchId:watched.body.watch.id}]);
    expect((await request(app).get(watchRoute).query({venueId:venue.id})
      .set("Authorization",`Bearer ${token}`)).body.watches).toEqual([]);
    expect((await request(app).put(pref).set("Authorization",`Bearer ${token}`)
      .send({preferredStart:null})).body.preferredStart).toBeNull();
  });

  it("publishes live slots from opening hours and area price", async () => {
    const { app, bookingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0702223300");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);

    const response = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    expect(response.status).toBe(200);
    expect(response.body.live).toBe(true);
    expect(response.body.slots.length).toBeGreaterThan(0);
    expect(response.body.slots[0].priceAfn).toBe(1800);
    expect(response.body.generatedAt).toBe("2026-10-04T00:00:00.000Z");
  });

  it("allows exactly one winner when two players race for the same slot", async () => {
    const { app, bookingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0702223311");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    const first = await register(app, authRepository, "PLAYER", "0702223322");
    const second = await register(app, authRepository, "PLAYER", "0702223333");
    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];

    const [a, b] = await Promise.all([
      request(app).post("/api/v1/bookings").set("Authorization", `Bearer ${first.body.accessToken}`).send({
        areaId: slot.areaId, startsAt: slot.startsAt, idempotencyKey: "race-player-a",
      }),
      request(app).post("/api/v1/bookings").set("Authorization", `Bearer ${second.body.accessToken}`).send({
        areaId: slot.areaId, startsAt: slot.startsAt, idempotencyKey: "race-player-b",
      }),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect([...bookingRepository.bookings.values()].filter((booking) => booking.status !== "CANCELLED")).toHaveLength(1);
  });

  it("prevents manual and online occupancy from overlapping", async () => {
    const { app, bookingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0702223344");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    const player = await register(app, authRepository, "PLAYER", "0702223355");
    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];

    const manual = await request(app).post("/api/v1/owner/bookings/manual")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({
        areaId: slot.areaId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        customerName: "Phone customer",
        customerPhone: "0791112233",
      });
    expect(manual.status).toBe(201);

    const online = await request(app).post("/api/v1/bookings")
      .set("Authorization", `Bearer ${player.body.accessToken}`)
      .send({ areaId: slot.areaId, startsAt: slot.startsAt, idempotencyKey: "manual-online-conflict" });
    expect(online.status).toBe(409);
    expect(online.body.error.code).toBe("SLOT_UNAVAILABLE");
  });

  it("owner blocks remove capacity and cancellation makes capacity available again", async () => {
    const { app, bookingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0702223366");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    const player = await register(app, authRepository, "PLAYER", "0702223377");

    let availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const blockedSlot = availability.body.slots[0];
    const block = await request(app).post("/api/v1/owner/blocks")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({ areaId: blockedSlot.areaId, startsAt: blockedSlot.startsAt, endsAt: blockedSlot.endsAt, reason: "Maintenance" });
    expect(block.status).toBe(201);

    availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    expect(availability.body.slots.some((slot: { startsAt: string }) => slot.startsAt === blockedSlot.startsAt)).toBe(false);

    const bookableSlot = availability.body.slots[0];
    const booked = await request(app).post("/api/v1/bookings")
      .set("Authorization", `Bearer ${player.body.accessToken}`)
      .send({ areaId: bookableSlot.areaId, startsAt: bookableSlot.startsAt, idempotencyKey: "cancel-frees-capacity" });
    expect(booked.status).toBe(201);

    const cancelled = await request(app).post(`/api/v1/bookings/${booked.body.booking.id}/cancel`)
      .set("Authorization", `Bearer ${player.body.accessToken}`)
      .send({ reason: "Plans changed" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.booking.status).toBe("CANCELLED");

    availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    expect(availability.body.slots.some((slot: { startsAt: string }) => slot.startsAt === bookableSlot.startsAt)).toBe(true);
  });

  it("lets the venue owner edit a blocked interval without losing conflict safety", async () => {
    const { app, bookingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0702223380");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    const auth = { Authorization: `Bearer ${owner.body.accessToken}` };

    let availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const originalSlot = availability.body.slots[0];
    const targetSlot = availability.body.slots[1];

    const created = await request(app)
      .post("/api/v1/owner/blocks")
      .set(auth)
      .send({
        areaId: originalSlot.areaId,
        startsAt: originalSlot.startsAt,
        endsAt: originalSlot.endsAt,
        reason: "Maintenance",
      });
    expect(created.status).toBe(201);

    const updated = await request(app)
      .put(`/api/v1/owner/blocks/${created.body.block.id}`)
      .set(auth)
      .send({
        areaId: targetSlot.areaId,
        startsAt: targetSlot.startsAt,
        endsAt: targetSlot.endsAt,
        reason: "Cleaning",
      });
    expect(updated.status).toBe(200);
    expect(updated.body.block.id).toBe(created.body.block.id);
    expect(updated.body.block.reason).toBe("Cleaning");

    availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    expect(availability.body.slots.some((slot: { startsAt: string }) => slot.startsAt === originalSlot.startsAt)).toBe(true);
    expect(availability.body.slots.some((slot: { startsAt: string }) => slot.startsAt === targetSlot.startsAt)).toBe(false);
  });

  it("retries the same player's idempotency key without creating a duplicate booking", async () => {
    const { app, bookingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0702223390");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    const player = await register(app, authRepository, "PLAYER", "0702223391");
    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];
    const body = { areaId: slot.areaId, startsAt: slot.startsAt, idempotencyKey: "stable-retry-key" };

    const first = await request(app).post("/api/v1/bookings").set("Authorization", `Bearer ${player.body.accessToken}`).send(body);
    const retry = await request(app).post("/api/v1/bookings").set("Authorization", `Bearer ${player.body.accessToken}`).send(body);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.body.booking.id).toBe(first.body.booking.id);
    expect([...bookingRepository.bookings.values()]).toHaveLength(1);
  });

  it("keeps owner booking controls tenant-scoped", async () => {
    const { app, bookingRepository, authRepository } = setup();
    const ownerA = await register(app, authRepository, "VENUE_OWNER", "0702223392");
    const ownerB = await register(app, authRepository, "VENUE_OWNER", "0702223393");
    const { venue } = bookingRepository.seedVenue(ownerA.body.user.id);
    bookingRepository.seedVenue(ownerB.body.user.id);
    const player = await register(app, authRepository, "PLAYER", "0702223394");
    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];
    const booked = await request(app).post("/api/v1/bookings")
      .set("Authorization", `Bearer ${player.body.accessToken}`)
      .send({ areaId: slot.areaId, startsAt: slot.startsAt, idempotencyKey: "tenant-scope-booking" });

    const denied = await request(app).post(`/api/v1/owner/bookings/${booked.body.booking.id}/cancel`)
      .set("Authorization", `Bearer ${ownerB.body.accessToken}`)
      .send({ reason: "Not my venue" });

    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("BOOKING_ACCESS_DENIED");
  });

  it("rejects impossible calendar dates", async () => {
    const { app, bookingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0702223395");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    const response = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-02-31`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("keeps existing booking service available in continuity mode while blocking new inventory writes", async () => {
    const { app, bookingRepository, authRepository, clock } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0702223387");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id, {
      trialEndsAt: new Date("2026-10-04T01:00:00.000Z"),
    });
    const auth = { Authorization: `Bearer ${owner.body.accessToken}` };

    clock.now = new Date("2026-10-04T00:30:00.000Z");
    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];

    const manual = await request(app)
      .post("/api/v1/owner/bookings/manual")
      .set(auth)
      .send({
        areaId: slot.areaId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        customerName: "Continuity customer",
      });
    expect(manual.status).toBe(201);

    clock.now = new Date("2026-10-04T02:00:00.000Z");

    const schedule = await request(app)
      .get("/api/v1/owner/schedule?date=2026-10-05")
      .set(auth);
    expect(schedule.status).toBe(200);
    expect(schedule.body.bookings.some((item: { id: string }) => item.id === manual.body.booking.id)).toBe(true);

    const deniedWrite = await request(app)
      .post("/api/v1/owner/bookings/manual")
      .set(auth)
      .send({
        areaId: slot.areaId,
        startsAt: "2026-10-05T06:00:00.000Z",
        endsAt: "2026-10-05T07:30:00.000Z",
        customerName: "Blocked after expiry",
      });
    expect(deniedWrite.status).toBe(403);
    expect(deniedWrite.body.error.code).toBe("SUBSCRIPTION_REQUIRED");

    const cancelled = await request(app)
      .post(`/api/v1/owner/bookings/${manual.body.booking.id}/cancel`)
      .set(auth)
      .send({ reason: "Customer cancelled" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.booking.status).toBe("CANCELLED");
  });

  it("does not expose bookable inventory after the trial expires", async () => {
    const { app, bookingRepository, authRepository, clock } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0702223388");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id, { trialEndsAt: new Date("2026-10-04T01:00:00.000Z") });
    clock.now = new Date("2026-10-04T02:00:00.000Z");

    const list = await request(app).get("/api/v1/venues");
    expect(list.body.venues.some((item: { id: string }) => item.id === venue.id)).toBe(false);

    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    expect(availability.status).toBe(400);
    expect(availability.body.error.code).toBe("VENUE_NOT_BOOKABLE");
  });

  it("pauses online booking without deleting existing venue inventory", async () => {
    const { app, bookingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0702223401");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    const player = await register(app, authRepository, "PLAYER", "0702223402");

    const before = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    expect(before.status).toBe(200);
    expect(before.body.slots.length).toBeGreaterThan(0);
    const slot = before.body.slots[0];

    venue.onlineBookingEnabled = false;

    const paused = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    expect(paused.status).toBe(200);
    expect(paused.body.slots).toHaveLength(0);

    const denied = await request(app).post("/api/v1/bookings")
      .set("Authorization", `Bearer ${player.body.accessToken}`)
      .send({ areaId: slot.areaId, startsAt: slot.startsAt, idempotencyKey: "paused-online-booking" });
    expect(denied.status).toBe(400);
    expect(denied.body.error.code).toBe("ONLINE_BOOKING_PAUSED");
  });

  it("enforces minimum notice and maximum advance booking windows", async () => {
    const { app, bookingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0702223403");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);

    venue.minimumBookingNoticeMinutes = 48 * 60;
    const tooSoon = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    expect(tooSoon.status).toBe(200);
    expect(tooSoon.body.slots).toHaveLength(0);

    venue.minimumBookingNoticeMinutes = 0;
    venue.maximumAdvanceBookingDays = 1;
    const tooFar = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-06`);
    expect(tooFar.status).toBe(200);
    expect(tooFar.body.slots).toHaveLength(0);
  });

  it("shows all pending online reservations in the correct owner's inbox, and resolves approvals/rejections",async()=>{
    const {app,bookingRepository,authRepository}=setup();
    const ownerA=await register(app,authRepository,"VENUE_OWNER","0702223451");
    const ownerB=await register(app,authRepository,"VENUE_OWNER","0702223452");
    const player=await register(app,authRepository,"PLAYER","0702223453");
    const {venue}=bookingRepository.seedVenue(ownerA.body.user.id);
    const other=bookingRepository.seedVenue(ownerB.body.user.id).venue;
    venue.bookingMode="APPROVAL";
    other.bookingMode="APPROVAL";
    const aAuth={Authorization:`Bearer ${ownerA.body.accessToken}`};
    const bAuth={Authorization:`Bearer ${ownerB.body.accessToken}`};
    const pAuth={Authorization:`Bearer ${player.body.accessToken}`};
    const slots=await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const later=await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-09`);
    const otherSlots=await request(app).get(`/api/v1/venues/${other.id}/availability?date=2026-10-06`);
    const make=async(slot:{areaId:string;startsAt:string},key:string)=>
      request(app).post("/api/v1/bookings").set(pAuth).send({
        areaId:slot.areaId,startsAt:slot.startsAt,idempotencyKey:key,
      });
    const first=await make(slots.body.slots[0],"pending-inbox-one");
    const second=await make(later.body.slots[0],"pending-inbox-later");
    const crossVenue=await make(otherSlots.body.slots[0],"pending-inbox-other");
    expect([first.status,second.status,crossVenue.status]).toEqual([201,201,201]);
    expect(first.body.booking.status).toBe("PENDING");
    const withoutAuth=await request(app).get("/api/v1/owner/bookings/pending");
    expect(withoutAuth.status).toBe(401);
    const cannotRead=await request(app).get("/api/v1/owner/bookings/pending").set(pAuth);
    expect(cannotRead.status).toBe(403);
    const inboxA=await request(app).get("/api/v1/owner/bookings/pending").set(aAuth);
    expect(inboxA.status).toBe(200);
    expect(inboxA.body.bookings.map((b:{id:string})=>b.id)).toEqual([
      first.body.booking.id,second.body.booking.id,
    ]);
    expect(inboxA.body.bookings.every((b:{status:string;source:string})=>
      b.status==="PENDING"&&b.source==="ONLINE")).toBe(true);
    const inboxB=await request(app).get("/api/v1/owner/bookings/pending").set(bAuth);
    expect(inboxB.body.bookings.map((b:{id:string})=>b.id)).toEqual([crossVenue.body.booking.id]);
    expect((await request(app).post(`/api/v1/owner/bookings/${first.body.booking.id}/confirm`).set(bAuth)).status).toBe(403);
    const approved=await request(app).post(`/api/v1/owner/bookings/${first.body.booking.id}/confirm`).set(aAuth);
    expect(approved.status).toBe(200);
    expect(approved.body.booking.status).toBe("CONFIRMED");
    const rejected=await request(app).post(`/api/v1/owner/bookings/${second.body.booking.id}/cancel`)
      .set(aAuth).send({reason:"Venue declined the request"});
    expect(rejected.status).toBe(200);
    expect(rejected.body.booking.status).toBe("CANCELLED");
    const empty=await request(app).get("/api/v1/owner/bookings/pending").set(aAuth);
    expect(empty.status).toBe(200);
    expect(empty.body.bookings).toEqual([]);
    expect((await request(app).get("/api/v1/owner/bookings/pending").set(bAuth)).body.bookings)
      .toHaveLength(1);
  });

  it("supports owner approval mode from pending online booking to confirmed booking", async () => {
    const { app, bookingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0702223404");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    venue.bookingMode = "APPROVAL";
    const player = await register(app, authRepository, "PLAYER", "0702223405");

    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];

    const booked = await request(app).post("/api/v1/bookings")
      .set("Authorization", `Bearer ${player.body.accessToken}`)
      .send({ areaId: slot.areaId, startsAt: slot.startsAt, idempotencyKey: "approval-mode-booking" });
    expect(booked.status).toBe(201);
    expect(booked.body.booking.status).toBe("PENDING");

    const confirmed = await request(app)
      .post(`/api/v1/owner/bookings/${booked.body.booking.id}/confirm`)
      .set("Authorization", `Bearer ${owner.body.accessToken}`);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.booking.status).toBe("CONFIRMED");
    expect(bookingRepository.bookings.get(booked.body.booking.id)?.status).toBe("CONFIRMED");
  });

  it("publishes one privacy-safe status per configured slot while keeping booked times non-bookable",async()=>{
    const {app,bookingRepository,authRepository}=setup();
    const owner=await register(app,authRepository,"VENUE_OWNER","0709001101");
    const {venue}=bookingRepository.seedVenue(owner.body.user.id);
    const player=await register(app,authRepository,"PLAYER","0709001102");
    const url=`/api/v1/venues/${venue.id}/availability?date=2026-10-05`;
    const before=await request(app).get(url);
    expect(before.status).toBe(200);
    expect(before.body.timeline.length).toBeGreaterThan(1);
    const slot=before.body.slots[0];
    expect(before.body.timeline.find((item:{startsAt:string})=>item.startsAt===slot.startsAt).status)
      .toBe("AVAILABLE");
    const booked=await request(app).post("/api/v1/bookings")
      .set("Authorization",`Bearer ${player.body.accessToken}`)
      .send({areaId:slot.areaId,startsAt:slot.startsAt,idempotencyKey:"public-grid-booking"});
    expect(booked.status).toBe(201);
    const after=await request(app).get(url);
    const occupied=after.body.timeline.find((item:{startsAt:string})=>item.startsAt===slot.startsAt);
    expect(occupied.status).toBe("UNAVAILABLE");
    expect(after.body.slots.some((item:{startsAt:string})=>item.startsAt===slot.startsAt)).toBe(false);
    // The public timetable intentionally never reveals booking source, customer or phone.
    expect(occupied).not.toHaveProperty("customerName");
    expect(occupied).not.toHaveProperty("customerPhone");
    expect(occupied).not.toHaveProperty("bookingId");
    expect(occupied).not.toHaveProperty("reason");
    expect(occupied).not.toHaveProperty("bookingSource");
    expect(occupied.priceAfn).toBe(1800);
  });

  it("shows configured but outside-notice slots in the public grid without making them bookable",async()=>{
    const {app,bookingRepository,authRepository}=setup();
    const owner=await register(app,authRepository,"VENUE_OWNER","0709001103");
    const {venue}=bookingRepository.seedVenue(owner.body.user.id);
    venue.minimumBookingNoticeMinutes=48*60;
    const response=await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    expect(response.status).toBe(200);
    expect(response.body.slots).toHaveLength(0);
    expect(response.body.timeline.length).toBeGreaterThan(0);
    expect(response.body.timeline.every((slot:{status:string})=>slot.status==="NOTICE_REQUIRED")).toBe(true);
  });


  it("paginates owner-only booking records with stable sorting and no cross-venue identity leakage",async()=>{
    const {app,authRepository,bookingRepository}=setup();
    const a=await register(app,authRepository,"VENUE_OWNER","0702924401");
    const b=await register(app,authRepository,"VENUE_OWNER","0702924402");
    const player=await register(app,authRepository,"PLAYER","0702924403");
    const {venue,areaId}=bookingRepository.seedVenue(a.body.user.id);
    const other=bookingRepository.seedVenue(b.body.user.id);
    const ids:string[]=[];
    for(let i=0;i<19;i++){
      const id="00000000-0000-4000-bbbb-"+String(i+1).padStart(12,"0");
      ids.push(id);
      bookingRepository.bookings.set(id,{
        id,venueId:venue.id,venueName:venue.name,areaId,areaName:"Pitch 1",
        playerUserId:null,source:i%2?"MANUAL":"ONLINE",status:"CONFIRMED",
        startsAt:new Date(Date.UTC(2026,9,5,i%12,0,0)).toISOString(),
        endsAt:new Date(Date.UTC(2026,9,5,i%12+1,0,0)).toISOString(),
        priceAfn:1200,currency:"AFN",customerName:"Alpha Customer "+i,
        customerPhone:"+93700000000",note:null,cancellationPolicySnapshot:"Test",
        cancelledAt:null,cancellationReason:null,
      });
    }
    const secretId="aaaaaaaa-0000-4000-8000-000000000001";
    bookingRepository.bookings.set(secretId,{
      ...bookingRepository.bookings.get(ids[0]!)!,
      id:secretId,venueId:other.venue.id,areaId:other.areaId,
      areaName:"Secret Court",customerName:"Secret Customer",customerPhone:"+93777777777",
    });
    const auth={Authorization:"Bearer "+a.body.accessToken};
    const unauth=await request(app).get("/api/v1/owner/bookings");
    expect(unauth.status).toBe(401);
    expect((await request(app).get("/api/v1/owner/bookings").set(
      "Authorization","Bearer "+player.body.accessToken)).status).toBe(403);
    const one=await request(app).get("/api/v1/owner/bookings")
      .query({scope:"ALL",page:1,pageSize:5}).set(auth);
    expect(one.status).toBe(200);
    expect(one.body.pageSize).toBe(5);
    expect(one.body.total).toBe(19);
    expect(one.body.hasMore).toBe(true);
    expect(one.body.bookings).toHaveLength(5);
    const two=await request(app).get("/api/v1/owner/bookings")
      .query({scope:"ALL",page:2,pageSize:5}).set(auth);
    expect(two.status).toBe(200);
    expect(two.body.bookings).toHaveLength(5);
    const pageIds=[...one.body.bookings,...two.body.bookings].map((item:{id:string})=>item.id);
    expect(new Set(pageIds).size).toBe(10);
    expect(JSON.stringify(one.body)+JSON.stringify(two.body)).not.toContain("Secret Customer");
    expect(JSON.stringify(one.body)+JSON.stringify(two.body)).not.toContain(secretId);
    expect(JSON.stringify(one.body)+JSON.stringify(two.body)).not.toContain("+93777777777");
    const otherView=await request(app).get("/api/v1/owner/bookings")
      .query({scope:"ALL"}).set("Authorization","Bearer "+b.body.accessToken);
    expect(otherView.body.total).toBe(1);
    expect(otherView.body.bookings[0].id).toBe(secretId);
  });

  it("enforces upcoming/history status filters, source and venue-local inclusive date windows",async()=>{
    const {app,authRepository,bookingRepository,clock}=setup();
    const owner=await register(app,authRepository,"VENUE_OWNER","0702924404");
    const {venue,areaId}=bookingRepository.seedVenue(owner.body.user.id);
    const add=(id:string,start:string,end:string,status:"PENDING"|"CONFIRMED"|"CANCELLED",
      source:"ONLINE"|"MANUAL",name:string)=>{
      bookingRepository.bookings.set(id,{id,venueId:venue.id,venueName:venue.name,
        areaId,areaName:"Pitch A",playerUserId:null,source,status,
        startsAt:start,endsAt:end,priceAfn:2000,currency:"AFN",
        customerName:name,customerPhone:null,note:null,cancellationPolicySnapshot:"Policy",
        cancelledAt:status==="CANCELLED"?clock.now.toISOString():null,
        cancellationReason:status==="CANCELLED"?"Cancelled":null});
    };
    add("00000000-0000-4000-bbbb-000000000101","2026-10-05T08:00:00Z","2026-10-05T09:00:00Z","CONFIRMED","ONLINE","Ada");
    add("00000000-0000-4000-bbbb-000000000102","2026-10-02T08:00:00Z","2026-10-02T09:00:00Z","CONFIRMED","MANUAL","Bashir");
    add("00000000-0000-4000-bbbb-000000000103","2026-10-06T08:00:00Z","2026-10-06T09:00:00Z","PENDING","ONLINE","Farid");
    add("00000000-0000-4000-bbbb-000000000104","2026-10-07T08:00:00Z","2026-10-07T09:00:00Z","CANCELLED","MANUAL","Darya");
    const auth={Authorization:"Bearer "+owner.body.accessToken};
    const get=(query:Record<string,string>)=>request(app).get("/api/v1/owner/bookings").query(query).set(auth);
    const upcoming=await get({scope:"UPCOMING"});
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.bookings.map((item:{customerName:string})=>item.customerName)).toEqual(["Ada"]);
    const history=await get({scope:"HISTORY"});
    expect(history.body.bookings.map((item:{customerName:string})=>item.customerName)).toEqual(["Darya","Bashir"]);
    const all=await get({scope:"ALL",source:"MANUAL",status:"CONFIRMED"});
    expect(all.body.bookings.map((item:{customerName:string})=>item.customerName)).toEqual(["Bashir"]);
    const search=await get({scope:"ALL",q:"ada"});
    expect(search.body.total).toBe(1);
    const date=await get({scope:"ALL",from:"2026-10-05",to:"2026-10-05"});
    expect(date.body.bookings.map((item:{customerName:string})=>item.customerName)).toEqual(["Ada"]);
  });

  it("rejects invalid / excessive owner booking queries rather than scanning or leaking records",async()=>{
    const {app,authRepository,bookingRepository}=setup();
    const owner=await register(app,authRepository,"VENUE_OWNER","0702924405");
    bookingRepository.seedVenue(owner.body.user.id);
    const auth={Authorization:"Bearer "+owner.body.accessToken};
    for(const query of [
      {page:"0"},{pageSize:"500"},{page:"501"},{scope:"UNKNOWN"},
      {from:"2026-02-30"},{from:"2026-10-30",to:"2026-10-01"},
      {q:"x".repeat(101)},{source:"INVALID"},{status:"UNKNOWN"},
    ]){
      const response=await request(app).get("/api/v1/owner/bookings").query(query).set(auth);
      expect(response.status).toBe(400);
    }
  });

});
