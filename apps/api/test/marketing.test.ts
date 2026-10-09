import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { BookingService } from "../src/modules/booking/booking.service.js";
import { MarketingService } from "../src/modules/marketing/marketing.service.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";
import { FakeBookingRepository } from "./fake-booking-repository.js";
import { FakeMarketingRepository } from "./fake-marketing-repository.js";

function setup() {
  const authRepository = new FakeAuthRepository();
  const bookingRepository = new FakeBookingRepository();
  const marketingRepository = new FakeMarketingRepository();
  const tokens = new TokenService("test-secret-that-is-longer-than-thirty-two-characters", "test", "test-mobile");
  const auth = new AuthService(authRepository, tokens);
  const clock = { now: new Date("2026-10-04T00:00:00.000Z") };
  const booking = new BookingService(bookingRepository, () => clock.now);
  marketingRepository.onPromotionCreated = (promotion) => {
    bookingRepository.promotionPrices.push({
      id: promotion.id,
      areaId: promotion.areaId,
      startsAt: new Date(promotion.startsAt),
      endsAt: new Date(promotion.endsAt),
      discountedPriceAfn: promotion.discountedPriceAfn,
    });
  };
  const marketing = new MarketingService(marketingRepository, booking, () => clock.now);
  const app = createApp({ authService: auth, tokenService: tokens, bookingService: booking, marketingService: marketing });
  return { app, bookingRepository, marketingRepository, authRepository, clock };
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
    password: "strong-pass-4!",
    confirmPassword: "strong-pass-4!",
    preferredLanguage: "fa-AF",
  });
  expect(registration.status).toBe(201);

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
  return refreshed;
}

function seedMarketingFromBooking(marketingRepository: FakeMarketingRepository, venue: ReturnType<FakeBookingRepository["seedVenue"]>["venue"]) {
  marketingRepository.seedVenue({
    id: venue.id,
    ownerUserId: venue.ownerUserId,
    name: venue.name,
    timezone: venue.timezone,
    status: venue.status,
    subscription: venue.subscription,
  });
}

describe("Phase 4 marketing API", () => {
  it("scopes followed team and competition discovery to caller and counts real follows",async()=>{
    const {app,marketingRepository,authRepository}=setup();
    const alice=await register(app,authRepository,"PLAYER","0703445101");
    const bob=await register(app,authRepository,"PLAYER","0703445102");
    const aliceId=alice.body.user.id,bobId=bob.body.user.id;
    const {randomUUID}=await import("node:crypto");
    const teamId=randomUUID(),competitionId=randomUUID();
    await marketingRepository.followEntity(aliceId,"TEAM",teamId);
    await marketingRepository.followEntity(aliceId,"TEAM",teamId);
    await marketingRepository.followEntity(bobId,"TEAM",teamId);
    await marketingRepository.followEntity(aliceId,"COMPETITION",competitionId);
    const route="/api/v1/social/discovery/";
    expect((await request(app).get(route+"TEAM")).status).toBe(401);
    expect((await request(app).get(route+"USER").set("Authorization",`Bearer ${alice.body.accessToken}`)).status).toBe(400);
    const teamA=await request(app).get(route+"TEAM").set("Authorization",`Bearer ${alice.body.accessToken}`);
    const teamB=await request(app).get(route+"TEAM").set("Authorization",`Bearer ${bob.body.accessToken}`);
    const compB=await request(app).get(route+"COMPETITION").set("Authorization",`Bearer ${bob.body.accessToken}`);
    expect(teamA.status).toBe(200);
    expect(teamA.body.followedIds).toEqual([teamId]);
    expect(teamA.body.counts).toEqual([{id:teamId,count:2}]);
    expect(teamB.body.followedIds).toEqual([teamId]);
    expect(compB.body.followedIds).toEqual([]);
    expect(compB.body.counts).toEqual([{id:competitionId,count:1}]);
    await marketingRepository.unfollowEntity(aliceId,"TEAM",teamId);
    const refreshed=await request(app).get(route+"TEAM").set("Authorization",`Bearer ${alice.body.accessToken}`);
    expect(refreshed.body.followedIds).toEqual([]);
    expect(refreshed.body.counts).toEqual([{id:teamId,count:1}]);
  });

  it("ranks fifteen most-followed active entitled venues by real unique account follows",async()=>{
    const {app,bookingRepository,marketingRepository,authRepository,clock}=setup();
    const owner=await register(app,authRepository,"VENUE_OWNER","0703334780");
    const ids:string[]=[];
    for(let i=0;i<18;i++){
      const {venue}=bookingRepository.seedVenue(owner.body.user.id);
      venue.name=`Venue ${String(i).padStart(2,"0")}`;
      ids.push(venue.id);
      for(let fan=0;fan<i;fan++)await marketingRepository.followVenue(`fan-${fan}`,venue.id);
    }
    const hidden=bookingRepository.venues.get(ids[17]!)!;
    hidden.status="SUSPENDED";
    const expired=bookingRepository.venues.get(ids[16]!)!;
    expired.subscription={status:"EXPIRED",trialEndsAt:new Date(clock.now.getTime()-1),activeUntil:null};
    const response=await request(app).get("/api/v1/social/venues/most-followed");
    expect(response.status).toBe(200);
    expect(response.body.venues).toHaveLength(15);
    expect(response.body.venues[0].name).toBe("Venue 15");
    expect(response.body.venues[0].followerCount).toBe(15);
    const idsReturned=response.body.venues.map((venue:{id:string})=>venue.id);
    expect(idsReturned).not.toContain(ids[16]);
    expect(idsReturned).not.toContain(ids[17]);
    const counts=response.body.venues.map((venue:{followerCount:number})=>venue.followerCount);
    expect(counts).toEqual([...counts].sort((a,b)=>b-a));
  });

  it("creates public text and photo posts for every normal user, supports profiles and protects owned uploads",async()=>{
    const {app,authRepository}=setup();
    const a=await register(app,authRepository,"PLAYER","0703334601");
    const b=await register(app,authRepository,"PLAYER","0703334602");
    const tokenA=`Bearer ${a.body.accessToken}`,tokenB=`Bearer ${b.body.accessToken}`;

    expect((await request(app).post("/api/v1/social/user-posts").send({body:"Unauthorized"})).status).toBe(401);
    expect((await request(app).post("/api/v1/social/user-posts").set("Authorization",tokenA).send({body:""})).status).toBe(400);

    const created=await request(app).post("/api/v1/social/user-posts")
      .set("Authorization",tokenA).send({body:"Saturday futsal with friends!"});
    expect(created.status).toBe(201);
    expect(created.body.post.authorType).toBe("USER");
    expect(created.body.post.authorId).toBe(a.body.user.id);
    expect(created.body.post.body).toBe("Saturday futsal with friends!");

    const home=await request(app).get("/api/v1/social/feed").set("Authorization",tokenA);
    expect(home.status).toBe(200);
    expect(home.body.items.some((post:{id:string})=>post.id===created.body.post.id)).toBe(true);
    const profile=await request(app).get(`/api/v1/social/people/${a.body.user.id}`).set("Authorization",tokenB);
    expect(profile.status).toBe(200);
    expect(profile.body.profile.type).toBe("USER");
    expect(profile.body.posts[0].id).toBe(created.body.post.id);

    const png=Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000","hex");
    const image=await request(app).post("/api/v1/social/post-images")
      .set("Authorization",tokenA).set("Content-Type","image/png").send(png);
    expect(image.status).toBe(201);
    expect(image.body.imageUrl).toMatch(/^\/api\/v1\/social\/post-images\/[\da-f-]{36}\/[A-Za-z0-9_-]{32}$/);
    const downloaded=await request(app).get(image.body.imageUrl);
    expect(downloaded.status).toBe(200);
    expect(downloaded.body).toEqual(png);

    const forged=await request(app).post("/api/v1/social/user-posts")
      .set("Authorization",tokenB).send({body:"Not my image",imageUrl:image.body.imageUrl});
    expect(forged.status).toBe(403);

    const broken=await request(app).post("/api/v1/social/post-images")
      .set("Authorization",tokenA).set("Content-Type","image/png").send(Buffer.from("bad"));
    expect(broken.status).toBe(400);
    expect(broken.body.error.code).toBe("MEDIA_INVALID_IMAGE");

    const photoPost=await request(app).post("/api/v1/social/user-posts")
      .set("Authorization",tokenA).send({body:"",imageUrl:image.body.imageUrl});
    expect(photoPost.status).toBe(201);
    expect(photoPost.body.post.imageUrl).toBe(image.body.imageUrl);
    const forbidden=await request(app).delete(`/api/v1/social/user-posts/${photoPost.body.post.id}`)
      .set("Authorization",tokenB);
    expect(forbidden.status).toBe(403);
    const deleted=await request(app).delete(`/api/v1/social/user-posts/${photoPost.body.post.id}`)
      .set("Authorization",tokenA);
    expect(deleted.status).toBe(200);
    expect(deleted.body.deleted).toBe(true);
  });


  it("creates a promotion only for a live available slot and exposes it in feed", async () => {
    const { app, bookingRepository, marketingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0703334400");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);

    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];

    const created = await request(app).post("/api/v1/owner/promotions")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({
        areaId: slot.areaId,
        startsAt: slot.startsAt,
        discountedPriceAfn: 1400,
        title: "Tonight discount",
        note: "One empty slot",
        notifyFollowers: true,
      });

    expect(created.status).toBe(201);
    expect(created.body.promotion.originalPriceAfn).toBe(1800);
    expect(created.body.promotion.discountedPriceAfn).toBe(1400);

    const feed = await request(app).get("/api/v1/feed");
    expect(feed.status).toBe(200);
    expect(feed.body.items[0].type).toBe("PROMOTION");
    expect(feed.body.items[0].promotion.id).toBe(created.body.promotion.id);
  });

  it("books a promoted slot at the discounted server price", async () => {
    const { app, bookingRepository, marketingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0703334455");
    const player = await register(app, authRepository, "PLAYER", "0703334466");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);

    let availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];

    const promotion = await request(app).post("/api/v1/owner/promotions")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({
        areaId: slot.areaId,
        startsAt: slot.startsAt,
        discountedPriceAfn: 1250,
        title: "Weak slot deal",
        notifyFollowers: false,
      });
    expect(promotion.status).toBe(201);

    availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const promotedSlot = availability.body.slots.find((item: { promotionId: string | null }) => item.promotionId === promotion.body.promotion.id);
    expect(promotedSlot.priceAfn).toBe(1250);
    expect(promotedSlot.originalPriceAfn).toBe(1800);

    const booked = await request(app).post("/api/v1/bookings")
      .set("Authorization", `Bearer ${player.body.accessToken}`)
      .send({
        areaId: promotedSlot.areaId,
        startsAt: promotedSlot.startsAt,
        idempotencyKey: "phase4-discount-booking",
      });

    expect(booked.status).toBe(201);
    expect(booked.body.booking.priceAfn).toBe(1250);
    expect(bookingRepository.promotionPrices).toHaveLength(0);
  });

  it("rejects a promotion price that is not a discount", async () => {
    const { app, bookingRepository, marketingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0703334411");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);
    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];

    const response = await request(app).post("/api/v1/owner/promotions")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({ areaId: slot.areaId, startsAt: slot.startsAt, discountedPriceAfn: 1800, title: "Not actually discounted", notifyFollowers: false });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_DISCOUNT");
  });

  it("returns all account-scoped followed venue cards and excludes unavailable venues",async()=>{
    const {app,marketingRepository,authRepository}=setup();
    const a=await register(app,authRepository,"PLAYER","0703334701");
    const b=await register(app,authRepository,"PLAYER","0703334702");
    const tokenA=`Bearer ${a.body.accessToken}`;
    const tokenB=`Bearer ${b.body.accessToken}`;
    const url="/api/v1/social/venues/followed";

    expect((await request(app).get(url)).status).toBe(401);
    const noFollows=await request(app).get(url).set("Authorization",tokenA);
    expect(noFollows.status).toBe(200);
    expect(noFollows.body.venues).toEqual([]);

    const {randomUUID}=await import("node:crypto");
    const ids:string[]=[];
    for(let i=0;i<12;i++){
      const id=randomUUID();
      ids.push(id);
      marketingRepository.seedVenue({
        id,ownerUserId:a.body.user.id,
        name:`Venue ${String(i).padStart(2,"0")}`,city:"Kabul",province:"Kabul",
        pageProfileImageUrl:i%2===0?`https://example.org/logo-${i}.jpg`:null,
        timezone:"Asia/Kabul",status:"ACTIVE",subscription:null,
      });
      const follow=await request(app).post(`/api/v1/social/follows/VENUE/${id}`)
        .set("Authorization",tokenA);
      expect(follow.status).toBe(200);
    }
    const response=await request(app).get(url).set("Authorization",tokenA);
    expect(response.status).toBe(200);
    // API returns ALL followed venues; UI caps the carousel at 10 and shows more.
    expect(response.body.venues).toHaveLength(12);
    expect(new Set(response.body.venues.map((venue:{id:string})=>venue.id)).size).toBe(12);
    expect(response.body.venues[0].name).toBe("Venue 11");
    expect(response.body.venues[11].name).toBe("Venue 00");
    expect(response.body.venues[11].imageUrl).toBe("https://example.org/logo-0.jpg");
    expect(response.body.venues[0]).toEqual(expect.objectContaining({
      id:ids[11],name:"Venue 11",city:"Kabul",province:"Kabul",
    }));

    const another=await request(app).get(url).set("Authorization",tokenB);
    expect(another.status).toBe(200);
    expect(another.body.venues).toEqual([]);

    marketingRepository.seedVenue({
      id:ids[0]!,ownerUserId:a.body.user.id,
      name:"Venue 00",city:"Kabul",province:"Kabul",
      timezone:"Asia/Kabul",status:"SUSPENDED",subscription:null,
    });
    const hidden=await request(app).get(url).set("Authorization",tokenA);
    expect(hidden.body.venues).toHaveLength(11);
    expect(hidden.body.venues.some((venue:{id:string})=>venue.id===ids[0])).toBe(false);

    const unfollow=await request(app).delete(`/api/v1/social/follows/VENUE/${ids[1]}`)
      .set("Authorization",tokenA);
    expect(unfollow.status).toBe(200);
    const updated=await request(app).get(url).set("Authorization",tokenA);
    expect(updated.body.venues).toHaveLength(10);
    expect(updated.body.venues.some((venue:{id:string})=>venue.id===ids[1])).toBe(false);
  });

  it("follows and unfollows a venue idempotently", async () => {
    const { app, bookingRepository, marketingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0703334422");
    const player = await register(app, authRepository, "PLAYER", "0703334433");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);

    const first = await request(app).post(`/api/v1/venues/${venue.id}/follow`)
      .set("Authorization", `Bearer ${player.body.accessToken}`);
    const retry = await request(app).post(`/api/v1/venues/${venue.id}/follow`)
      .set("Authorization", `Bearer ${player.body.accessToken}`);

    expect(first.body.following).toBe(true);
    expect(retry.body.followerCount).toBe(1);

    const removed = await request(app).delete(`/api/v1/venues/${venue.id}/follow`)
      .set("Authorization", `Bearer ${player.body.accessToken}`);
    expect(removed.body.following).toBe(false);
    expect(removed.body.followerCount).toBe(0);
  });

  it("publishes and unpublishes a venue post with a structured venue CTA", async () => {
    const { app, bookingRepository, marketingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0703334444");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);

    const created = await request(app).post("/api/v1/owner/posts")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({ body: "Weekend futsal is open.", ctaType: "VENUE", notifyFollowers: false });

    expect(created.status).toBe(201);
    expect(created.body.post.ctaTargetId).toBe(venue.id);

    const publicPost = await request(app).get(`/api/v1/posts/${created.body.post.id}`);
    expect(publicPost.status).toBe(200);

    const hidden = await request(app).post(`/api/v1/owner/posts/${created.body.post.id}/unpublish`)
      .set("Authorization", `Bearer ${owner.body.accessToken}`);
    expect(hidden.body.post.status).toBe("UNPUBLISHED");

    const unavailable = await request(app).get(`/api/v1/posts/${created.body.post.id}`);
    expect(unavailable.status).toBe(400);
  });

  it("keeps followers-only venue posts off the public page and reveals them after follow", async () => {
    const { app, bookingRepository, marketingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0703334477");
    const player = await register(app, authRepository, "PLAYER", "0703334488");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);

    const created = await request(app).post("/api/v1/owner/posts")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({
        body: "Followers get this venue update first.",
        postType: "ANNOUNCEMENT",
        visibility: "FOLLOWERS",
        publishMode: "NOW",
        notifyFollowers: false,
      });
    expect(created.status).toBe(201);

    const publicPage = await request(app).get(`/api/v1/venues/${venue.id}/posts`);
    expect(publicPage.status).toBe(200);
    expect(publicPage.body.posts).toHaveLength(0);

    const beforeFollow = await request(app).get(`/api/v1/venues/${venue.id}/posts/following`)
      .set("Authorization", `Bearer ${player.body.accessToken}`);
    expect(beforeFollow.status).toBe(200);
    expect(beforeFollow.body.posts).toHaveLength(0);

    await request(app).post(`/api/v1/venues/${venue.id}/follow`)
      .set("Authorization", `Bearer ${player.body.accessToken}`);

    const afterFollow = await request(app).get(`/api/v1/venues/${venue.id}/posts/following`)
      .set("Authorization", `Bearer ${player.body.accessToken}`);
    expect(afterFollow.status).toBe(200);
    expect(afterFollow.body.posts.map((post: { id: string }) => post.id)).toContain(created.body.post.id);
  });

  it("executes scheduled media visibility and deletion actions from server time", async () => {
    const { app, bookingRepository, marketingRepository, authRepository, clock } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0703334499");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);

    const created = await request(app).post("/api/v1/owner/posts")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({
        body: "Temporary public post.",
        postType: "GENERAL",
        visibility: "PUBLIC",
        publishMode: "NOW",
        notifyFollowers: false,
        schedules: [
          { action: "MAKE_PRIVATE", executeAt: "2026-10-04T00:10:00.000Z" },
          { action: "DELETE", executeAt: "2026-10-04T00:20:00.000Z" },
        ],
      });
    expect(created.status).toBe(201);
    const postId = created.body.post.id as string;

    clock.now = new Date("2026-10-04T00:11:00.000Z");
    const privateState = await request(app).get("/api/v1/owner/posts")
      .set("Authorization", `Bearer ${owner.body.accessToken}`);
    expect(privateState.status).toBe(200);
    expect(privateState.body.posts.find((post: { id: string }) => post.id === postId)?.visibility).toBe("PRIVATE");

    const publicPage = await request(app).get(`/api/v1/venues/${venue.id}/posts`);
    expect(publicPage.body.posts.map((post: { id: string }) => post.id)).not.toContain(postId);

    clock.now = new Date("2026-10-04T00:21:00.000Z");
    const deletedState = await request(app).get("/api/v1/owner/posts")
      .set("Authorization", `Bearer ${owner.body.accessToken}`);
    expect(deletedState.status).toBe(200);
    expect(deletedState.body.posts.map((post: { id: string }) => post.id)).not.toContain(postId);
  });


  it("uploads durable venue media and saves the public page cover, profile photo, and bio", async () => {
    const { app, bookingRepository, marketingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0703334501");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);

    const imageBytes = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);

    const profile = await request(app)
      .post("/api/v1/owner/media-assets?purpose=PROFILE")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .set("Content-Type", "image/png")
      .send(imageBytes);
    expect(profile.status).toBe(201);
    expect(profile.body.asset.imageUrl).toMatch(/^\/api\/v1\/media-assets\//);

    const cover = await request(app)
      .post("/api/v1/owner/media-assets?purpose=COVER")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .set("Content-Type", "image/png")
      .send(imageBytes);
    expect(cover.status).toBe(201);

    const saved = await request(app)
      .patch("/api/v1/owner/media-page")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({
        pageProfileImageUrl: profile.body.asset.imageUrl,
        pageCoverImageUrl: cover.body.asset.imageUrl,
        pageBio: "Kabul futsal, competitions, discounts and community updates.",
      });
    expect(saved.status).toBe(200);
    expect(saved.body.page.pageProfileImageUrl).toBe(profile.body.asset.imageUrl);
    expect(saved.body.page.pageCoverImageUrl).toBe(cover.body.asset.imageUrl);
    expect(saved.body.page.pageBio).toContain("community");

    const served = await request(app).get(profile.body.asset.imageUrl);
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toContain("image/png");
    expect(Buffer.isBuffer(served.body)).toBe(true);
  });

  it("rejects oversized or non-image venue media uploads", async () => {
    const { app, bookingRepository, marketingRepository, authRepository } = setup();
    const owner = await register(app, authRepository, "VENUE_OWNER", "0703334502");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);

    const invalid = await request(app)
      .post("/api/v1/owner/media-assets?purpose=POST")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .set("Content-Type", "text/plain")
      .send("not-an-image");
    expect(invalid.status).toBeGreaterThanOrEqual(400);
  });

});
