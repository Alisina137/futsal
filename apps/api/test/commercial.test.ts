import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { CommercialService } from "../src/modules/commercial/commercial.service.js";
import type {AdminAnalyticsDays,AdminAnalyticsResponse} from "@leaguekick/contracts";
import {adminAnalyticsResponseSchema} from "@leaguekick/contracts";
import type {
  CommercialRepository,
  CommercialSettingsRecord,
  CommercialVenueRecord,
} from "../src/modules/commercial/commercial.types.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";

class FakeCommercialRepository implements CommercialRepository {
  requested = false;
  activated = false;
  userStatus: "ACTIVE" | "SUSPENDED" = "ACTIVE";
  lastFilters:Record<string,unknown>={};
  revokedSessions=false;
  userNote:string|null=null;
  lastPage:{target:"users"|"venues";query:string|undefined;page:number;size:number;sort:string}|null=null;
  venue: CommercialVenueRecord = {
    id: "11111111-1111-4111-8111-111111111111",
    ownerUserId: "22222222-2222-4222-8222-222222222222",
    name: "Kabul Arena",
    province: "Kabul",
    city: "Kabul",
    address: "District 10",
    timezone: "Asia/Kabul",
    status: "ACTIVE",
    verificationStatus: "PENDING",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    subscription: {
      venueId: "11111111-1111-4111-8111-111111111111",
      status: "TRIAL",
      trialStartedAt: new Date("2026-10-01T00:00:00.000Z"),
      trialEndsAt: new Date("2026-10-04T00:00:00.000Z"),
      activeUntil: null,
    },
  };

  async getOwnerVenue(ownerUserId: string) {
    return ownerUserId === this.venue.ownerUserId ? this.venue : null;
  }
  async getVenue(venueId: string) { return venueId === this.venue.id ? this.venue : null; }
  async getSettings(): Promise<CommercialSettingsRecord | null> { return null; }
  async listPayments() { return []; }
  async requestReactivation() { this.requested = true; }
  async analyticsSnapshot(
    ownerUserId: string,
    _startsAt: Date,
    _endsAt: Date,
    from: string,
  ) {
    if (ownerUserId !== this.venue.ownerUserId) return null;
    const current = from === "2026-10-05";
    return {
      venue: this.venue,
      activeAreaCount: 1,
      openingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        isClosed: false,
        opensAt: "08:00",
        closesAt: "22:00",
      })),
      bookings: current ? [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          areaId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          playerUserId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          customerName: null,
          customerPhone: null,
          status: "CONFIRMED" as const,
          source: "ONLINE" as const,
          startsAt: new Date("2026-10-05T04:00:00.000Z"),
          endsAt: new Date("2026-10-05T05:30:00.000Z"),
          priceAfn: 1800,
          cancellationReason: null,
          cancelledAt: null,
          createdAt: new Date("2026-10-04T12:00:00.000Z"),
        },
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          areaId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          playerUserId: null,
          customerName: "Cancelled customer",
          customerPhone: "0700000000",
          status: "CANCELLED" as const,
          source: "MANUAL" as const,
          startsAt: new Date("2026-10-05T06:00:00.000Z"),
          endsAt: new Date("2026-10-05T07:30:00.000Z"),
          priceAfn: 1800,
          cancellationReason: "Customer changed plans",
          cancelledAt: new Date("2026-10-05T02:00:00.000Z"),
          createdAt: new Date("2026-10-04T13:00:00.000Z"),
        },
      ] : [],
      timetables: [],
      exceptions: [],
      blocks: [],
      promotions: [],
      followerCount: 12,
      followerCreatedAt: current ? [new Date("2026-10-05T05:00:00.000Z")] : [],
      posts: [],
      competitions: [],
      competitionTeams: [],
      competitionMatches: [],
    };
  }
  async adminAnalytics(now:Date,days:AdminAnalyticsDays):Promise<Omit<AdminAnalyticsResponse,"generatedAt">>{
    return {
      period:{from:"2026-09-12",to:"2026-10-11",days,timezone:"Asia/Kabul"},
      totals:{users:55,activeAccounts:50,venues:12,activeVenues:10,
        verifiedVenues:9,payingVenues:6,payingTeamManagers:4,
        activeExtraTeamSlots:2,trialStartedVenues:10,trialConvertedVenues:4,teams:8,activeCompetitions:3},
      metrics:{newUsers:5,newVenues:2,newTeams:1,newCompetitions:1,
        confirmedBookings:7,onlineConfirmedBookings:4,
        bookingGmvAfn:7500,recordedVenuePaymentsAfn:1000,recordedVenuePaymentsCount:1},
      daily:[{date:"2026-10-11",newUsers:5,newVenues:2,newTeams:1,newCompetitions:1,
        confirmedBookings:7,bookingGmvAfn:7500,recordedVenuePaymentsAfn:1000}],
      roleGrants:[{role:"VENUE_OWNER",count:6}],
      topProvinces:[{province:"Kabul",venues:12}],
      attention:{pendingVenueVerifications:2,pendingRoleSubscriptions:2,
        pendingExtraTeamSlots:1,pendingBookings:1,expiringPaidVenues7d:1},
      revenueScope:"RECORDED_VENUE_PAYMENTS_ONLY",
      gmvScope:"CONFIRMED_BOOKING_VALUE_NOT_CASH",
    };
  }
  async adminDashboard() {
    return {
      activeUsers: 1,
      activeVenues: 1,
      pendingVenueVerifications: 1,
      trialVenues: 0,
      paidVenues: 0,
      expiredVenues: 1,
      recordedPaymentsAfn: 0,
      bookingGmvAfn: 1800,
    };
  }
  async countUsers(){return 73;}
  async countUsersFiltered(_query:string|undefined,filters:import("@leaguekick/contracts").AdminUserDirectoryFilter){
    this.lastFilters=filters;return filters.status||filters.role||filters.city ? 1 : 73;
  }
  async listUsersFiltered(query:string|undefined,page:number,pageSize:number,sort:"newest"|"oldest",
    filters:import("@leaguekick/contracts").AdminUserDirectoryFilter){
    this.lastFilters=filters;return this.listUsers(query,page,pageSize,sort);
  }
  async getUserDetail(userId:string){
    if(userId!=="11111111-1111-4111-8111-111111111111")return null;
    return {
      user:{id:userId,displayName:"Test",username:"test",phone:"+93700000000",
        status:"ACTIVE" as const,roles:[],createdAt:"2026-10-01T00:00:00.000Z",
        city:"Kabul",updatedAt:"2026-10-01T00:00:00.000Z"},
      effectiveRoles:[],roleProvenance:[],conflicts:[],subscriptions:[],
      teams:[],reservations:[],activity:[],sessions:{active:1,total:1},
    };
  }
  async revokeUserSessions(_actor:string,_user:string,_reason:string){
    this.revokedSessions=true;
  }
  async noteUser(_actor:string,_user:string,note:string,_reason:string){
    this.userNote=note;
  }
  async countVenues(){return 51;}
  async listUsers(query?:string,page=1,size=50,sort="newest"){
    this.lastPage={target:"users",query,page,size,sort};return [];
  }
  async listVenues(query?:string,page=1,size=50,sort="newest") {
    this.lastPage={target:"venues",query,page,size,sort};
    return [{
      id: this.venue.id,
      ownerUserId: this.venue.ownerUserId,
      name: this.venue.name,
      province: this.venue.province,
      city: this.venue.city,
      address: this.venue.address,
      status: this.venue.status,
      verificationStatus: this.venue.verificationStatus,
      subscriptionState: "EXPIRED" as const,
      trialEndsAt: this.venue.subscription?.trialEndsAt?.toISOString() ?? null,
      activeUntil: null,
      createdAt: this.venue.createdAt.toISOString(),
    }];
  }
  async setUserStatus(_actor: string, _user: string, status: "ACTIVE" | "SUSPENDED") { this.userStatus = status; }
  async applyVenueAction(_actor: string, _venue: string, action: "VERIFY" | "REJECT" | "SUSPEND" | "RESTORE") {
    if (action === "VERIFY") this.venue.verificationStatus = "VERIFIED";
    if (action === "SUSPEND") this.venue.status = "SUSPENDED";
    if (action === "RESTORE") this.venue.status = "ACTIVE";
  }
  async activateSubscription() { this.activated = true; }
  async extendTrial() {}
  async voidPayment() {}
  async updateSettings(_actor: string, input: Omit<CommercialSettingsRecord, "updatedAt">, now: Date) {
    return { ...input, updatedAt: now };
  }
  async listAuditLogs() { return []; }
  async addSupportNote() {}
  async unpublishPost() {}
  async closePromotion() {}
}

function setup() {
  const authRepository = new FakeAuthRepository();
  const tokens = new TokenService("test-secret-that-is-longer-than-thirty-two-characters", "test", "test-mobile");
  const auth = new AuthService(authRepository, tokens);
  const repository = new FakeCommercialRepository();
  const clock = new Date("2026-10-05T00:00:00.000Z");
  const commercial = new CommercialService(repository, () => clock);
  const app = createApp({ authService: auth, tokenService: tokens, commercialService: commercial });
  return { app, tokens, repository, commercial };
}

describe("Admin Phase 1 paged directories",()=>{
  it("returns server page metadata and query/sort params with strict bounds",async()=>{
    const {app,tokens,repository}=setup();
    const admin=await tokens.createAccessToken("admin",["PLATFORM_ADMIN"]);
    const header={Authorization:`Bearer ${admin.token}`};
    const users=await request(app).get("/api/v1/admin/users/page")
      .query({q:"abc",page:2,pageSize:25,sort:"oldest"}).set(header);
    expect(users.status).toBe(200);
    expect(users.body).toMatchObject({page:2,pageSize:25,total:73,hasMore:true});
    expect(repository.lastPage).toEqual({
      target:"users",query:"abc",page:2,size:25,sort:"oldest",
    });
    const venues=await request(app).get("/api/v1/admin/venues/page")
      .query({page:3,pageSize:25,sort:"newest"}).set(header);
    expect(venues.status).toBe(200);
    expect(venues.body).toMatchObject({page:3,pageSize:25,total:51,hasMore:false});
    expect(repository.lastPage).toEqual({
      target:"venues",query:undefined,page:3,size:25,sort:"newest",
    });
  });
  it("rejects invalid limits, invalid sort and non-admin access",async()=>{
    const {app,tokens}=setup();
    const admin=await tokens.createAccessToken("admin",["PLATFORM_ADMIN"]);
    const ordinary=await tokens.createAccessToken("user",[]);
    for(const suffix of ["?page=0","?pageSize=1001","?sort=secret"]){
      const r=await request(app).get("/api/v1/admin/users/page"+suffix)
        .set("Authorization",`Bearer ${admin.token}`);
      expect(r.status).toBe(400);
    }
    const blocked=await request(app).get("/api/v1/admin/users/page")
      .set("Authorization",`Bearer ${ordinary.token}`);
    expect(blocked.status).toBe(403);
  });
});

describe("Admin Phase 2 aggregated analytics",()=>{
  it("serves period-limited typed metrics to platform admins only",async()=>{
    const {app,tokens}=setup();
    const admin=await tokens.createAccessToken("admin",["PLATFORM_ADMIN"]);
    const response=await request(app).get("/api/v1/admin/analytics?days=90")
      .set("Authorization",`Bearer ${admin.token}`);
    expect(response.status).toBe(200);
    const parsed=adminAnalyticsResponseSchema.parse(response.body);
    expect(parsed.period.days).toBe(90);
    expect(parsed.metrics.recordedVenuePaymentsAfn).toBe(1000);
    expect(parsed.revenueScope).toBe("RECORDED_VENUE_PAYMENTS_ONLY");
    expect(parsed.gmvScope).toBe("CONFIRMED_BOOKING_VALUE_NOT_CASH");
    expect(parsed.attention.pendingRoleSubscriptions).toBe(2);
    expect(parsed.roleGrants[0]?.role).toBe("VENUE_OWNER");
  });
  it("rejects invalid horizon and non-admin requests",async()=>{
    const {app,tokens}=setup();
    const admin=await tokens.createAccessToken("admin",["PLATFORM_ADMIN"]);
    const user=await tokens.createAccessToken("ordinary",[]);
    for(const days of ["0","31","366","all","-7"]){
      const response=await request(app).get("/api/v1/admin/analytics?days="+days)
        .set("Authorization",`Bearer ${admin.token}`);
      expect(response.status).toBe(400);
    }
    const denied=await request(app).get("/api/v1/admin/analytics?days=7")
      .set("Authorization",`Bearer ${user.token}`);
    expect(denied.status).toBe(403);
  });
});

describe("Phase 7 commercial SaaS API", () => {
  it("puts expired owners into continuity mode with payment/config visibility", async () => {
    const { app, tokens, repository } = setup();
    const access = await tokens.createAccessToken(repository.venue.ownerUserId, ["VENUE_OWNER"]);
    const response = await request(app)
      .get("/api/v1/owner/subscription")
      .set("Authorization", `Bearer ${access.token}`);

    expect(response.status).toBe(200);
    expect(response.body.subscription.state).toBe("EXPIRED");
    expect(response.body.subscription.accessMode).toBe("CONTINUITY");
    expect(response.body.subscription.canServiceExistingBookings).toBe(true);
    expect(response.body.settings.trialDurationHours).toBe(72);
  });

  it("records a reactivation request without granting entitlement", async () => {
    const { app, tokens, repository } = setup();
    const access = await tokens.createAccessToken(repository.venue.ownerUserId, ["VENUE_OWNER"]);

    const response = await request(app)
      .post("/api/v1/owner/subscription/reactivation-request")
      .set("Authorization", `Bearer ${access.token}`);

    expect(response.status).toBe(202);
    expect(repository.requested).toBe(true);
    expect(repository.venue.subscription?.status).toBe("TRIAL");
  });

  it("calculates occupancy and booking-value analytics from authoritative bookings", async () => {
    const { commercial, repository } = setup();
    const result = await commercial.ownerAnalytics(repository.venue.ownerUserId, "2026-10-05", "2026-10-05");

    expect(result.bookingCount).toBe(2);
    expect(result.cancelledBookingCount).toBe(1);
    expect(result.onlineBookingCount).toBe(1);
    expect(result.grossBookingValueAfn).toBe(1800);
    expect(result.bookedMinutes).toBe(90);
    expect(result.availableMinutes).toBe(14 * 60);
    expect(result.averageBookingValueAfn).toBe(1800);
    expect(result.uniqueCustomerCount).toBe(1);
    expect(result.newFollowerCount).toBe(1);
    expect(result.daily).toHaveLength(1);
    expect(result.weekdays).toHaveLength(7);
    expect(result.hours).toHaveLength(24);
    expect(result.comparison.previousFrom).toBe("2026-10-04");
    expect(result.comparison.previousTo).toBe("2026-10-04");
  });

  it("protects platform admin routes with PLATFORM_ADMIN role", async () => {
    const { app, tokens } = setup();
    const player = await tokens.createAccessToken("33333333-3333-4333-8333-333333333333", ["PLAYER"]);
    const denied = await request(app)
      .get("/api/v1/admin/dashboard")
      .set("Authorization", `Bearer ${player.token}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("ROLE_REQUIRED");

    const admin = await tokens.createAccessToken("44444444-4444-4444-8444-444444444444", ["PLATFORM_ADMIN"]);
    const allowed = await request(app)
      .get("/api/v1/admin/dashboard")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.pendingVenueVerifications).toBe(1);
  });

  it("blocks an already-issued access token as soon as the account is suspended", async () => {
    const { app, tokens } = setup();
    let accountStatus: "ACTIVE" | "SUSPENDED" = "ACTIVE";
    tokens.setAccessValidator(async () => accountStatus);

    const admin = await tokens.createAccessToken("44444444-4444-4444-8444-444444444444", ["PLATFORM_ADMIN"]);
    const before = await request(app)
      .get("/api/v1/admin/dashboard")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(before.status).toBe(200);

    accountStatus = "SUSPENDED";

    const after = await request(app)
      .get("/api/v1/admin/dashboard")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("allows an admin to activate a venue subscription", async () => {
    const { app, tokens, repository } = setup();
    const admin = await tokens.createAccessToken("44444444-4444-4444-8444-444444444444", ["PLATFORM_ADMIN"]);
    const response = await request(app)
      .post(`/api/v1/admin/venues/${repository.venue.id}/subscription/activate`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ months: 1, amountAfn: 1000, provider: "MANUAL", providerReference: "cash-001", note: "Paid at office" });

    expect(response.status).toBe(201);
    expect(repository.activated).toBe(true);
  });
});

describe("Admin Phase 3 user directory and actions",()=>{
  const id="11111111-1111-4111-8111-111111111111";
  it("passes validated user filters to the repository",async()=>{
    const {app,tokens,repository}=setup();
    const signed=await tokens.createAccessToken("admin",["PLATFORM_ADMIN"]);
    const header={Authorization:"Bearer "+signed.token};
    const ok=await request(app).get("/api/v1/admin/users/page")
      .query({role:"REFEREE",status:"ACTIVE",city:"Kabul"}).set(header);
    expect(ok.status).toBe(200);
    expect(ok.body.total).toBe(1);
    expect(repository.lastFilters).toMatchObject({role:"REFEREE",status:"ACTIVE",city:"Kabul"});
    const bad=await request(app).get("/api/v1/admin/users/page").query({role:"INVALID"}).set(header);
    expect(bad.status).toBe(400);
  });
  it("returns details only for authorized platform administrators",async()=>{
    const {app,tokens}=setup();
    const admin=await tokens.createAccessToken("admin",["PLATFORM_ADMIN"]);
    const plain=await tokens.createAccessToken("plain",[]);
    const details=await request(app).get("/api/v1/admin/users/"+id)
      .set({Authorization:"Bearer "+admin.token});
    expect(details.status).toBe(200);
    expect(details.body.detail).toMatchObject({user:{id},conflicts:[],sessions:{active:1,total:1}});
    const forbidden=await request(app).get("/api/v1/admin/users/"+id)
      .set({Authorization:"Bearer "+plain.token});
    expect(forbidden.status).toBe(403);
  });
  it("rejects missing reason and delegates private note/session actions",async()=>{
    const {app,tokens,repository}=setup();
    const admin=await tokens.createAccessToken("admin",["PLATFORM_ADMIN"]);
    const header={Authorization:"Bearer "+admin.token};
    expect((await request(app).post("/api/v1/admin/users/"+id+"/revoke-sessions")
      .send({reason:"x"}).set(header)).status).toBe(400);
    expect((await request(app).post("/api/v1/admin/users/"+id+"/revoke-sessions")
      .send({reason:"security review"}).set(header)).status).toBe(200);
    expect(repository.revokedSessions).toBe(true);
    expect((await request(app).post("/api/v1/admin/users/"+id+"/notes")
      .send({reason:"account review",note:"Contact by support"}).set(header)).status).toBe(201);
    expect(repository.userNote).toBe("Contact by support");
  });
});
