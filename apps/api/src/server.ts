import { createDatabase } from "@leaguekick/database";
import { createApp } from "./app.js";
import { env } from "./env.js";
import { DrizzleAuthRepository } from "./modules/auth/auth.repository.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { TokenService } from "./modules/auth/token.service.js";
import { DrizzleBookingRepository } from "./modules/booking/booking.repository.js";
import { BookingService } from "./modules/booking/booking.service.js";
import { DrizzleOwnerOnboardingRepository } from "./modules/owner/owner.repository.js";
import { OwnerOnboardingService } from "./modules/owner/owner.service.js";
import { DrizzleMarketingRepository } from "./modules/marketing/marketing.repository.js";
import { MarketingService } from "./modules/marketing/marketing.service.js";
import { DrizzleNotificationRepository } from "./modules/notifications/notification.repository.js";
import { NotificationService } from "./modules/notifications/notification.service.js";
import {DrizzlePushDeliveryStore,PushDispatcher} from "./modules/notifications/push-delivery.js";
import { DrizzleTeamRepository } from "./modules/team/team.repository.js";
import { TeamService } from "./modules/team/team.service.js";
import {TeamSlotsService} from "./modules/team/team-slots.js";
import { TeamManagerPhase1Service } from "./modules/team/team-manager-phase1.routes.js";
import { TeamManagerPhase2Service } from "./modules/team/team-manager-phase2.routes.js";
import { TeamManagerPhase3Service } from "./modules/team/team-manager-phase3.routes.js";
import { PlayerDashboardPhase1Service } from "./modules/team/player-dashboard-phase1.routes.js";
import { PlayerDashboardPhase2Service } from "./modules/team/player-dashboard-phase2.routes.js";
import { PlayerDashboardPhase3Service } from "./modules/team/player-dashboard-phase3.routes.js";
import { DrizzleCompetitionRepository } from "./modules/competition/competition.repository.js";
import { CompetitionService } from "./modules/competition/competition.service.js";
import {RefereeService} from "./modules/referee/referee.routes.js";
import {RefereePhase2Service} from "./modules/referee/referee-phase2.routes.js";
import {RefereeCareerService} from "./modules/referee/referee-career.routes.js";
import { DrizzleCommercialRepository } from "./modules/commercial/commercial.repository.js";
import { CommercialService } from "./modules/commercial/commercial.service.js";
import {AdminTrustService} from "./modules/trust/admin-trust.service.js";
import { DrizzleTimetableRepository } from "./modules/timetable/timetable.repository.js";
import { TimetableService } from "./modules/timetable/timetable.service.js";
import { ManualTeamService } from "./modules/manual-team/manual-team.service.js";

const { db, pool } = createDatabase(env.DATABASE_URL);
const authRepository = new DrizzleAuthRepository(db);
const tokens = new TokenService(env.ACCESS_TOKEN_SECRET, env.ACCESS_TOKEN_ISSUER, env.ACCESS_TOKEN_AUDIENCE);

async function deliverEmailCode(email:string,code:string,purpose:"verify"|"reset") {
  if(!env.EMAIL_AUTH_WEBHOOK_URL)throw new Error("Email delivery is not configured.");
  const response=await fetch(env.EMAIL_AUTH_WEBHOOK_URL,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      ...(env.EMAIL_AUTH_WEBHOOK_TOKEN?{Authorization:`Bearer ${env.EMAIL_AUTH_WEBHOOK_TOKEN}`}:{}),
    },
    body:JSON.stringify({
      to:email,
      subject:purpose==="verify"?"Verify your Futsal email":"Reset your Futsal credentials",
      message:`Your Futsal ${purpose==="verify"?"email verification":"password recovery"} code is ${code}. It expires in 10 minutes.`,
    }),
    signal:AbortSignal.timeout(10_000),
  });
  if(!response.ok)throw new Error("Email delivery provider failed.");
}

const auth = new AuthService(authRepository, tokens, {
  passwordResetSecret: env.PASSWORD_RESET_SECRET,
  exposePasswordResetCode: env.NODE_ENV !== "production" && env.PASSWORD_RESET_DEV_MODE,
  ...(env.EMAIL_AUTH_WEBHOOK_URL ? { deliverEmailCode } : {}),
});
tokens.setAccessValidator(async (userId) => (await authRepository.getUserById(userId))?.status ?? null);
tokens.setSessionRevocationValidator((userId)=>authRepository.getSessionsRevokedAt(userId));
// Reject a revoked PLATFORM_ADMIN on the next request, not when the old JWT expires.
tokens.setAdminRoleValidator(async(userId)=>(await authRepository.getUserById(userId))?.roles??[]);
const ownerRepository = new DrizzleOwnerOnboardingRepository(db);
const notificationRepository = new DrizzleNotificationRepository(db);
const notificationService = new NotificationService(notificationRepository);
const pushDispatcher=new PushDispatcher(new DrizzlePushDeliveryStore(db));
let pushTickBusy=false;
const pushTimer=setInterval(()=>{
  if(pushTickBusy)return;
  pushTickBusy=true;
  void pushDispatcher.run().catch(error=>console.error(JSON.stringify({
    event:"push_dispatch_failed",message:error instanceof Error?error.message:String(error),
  }))).finally(()=>{pushTickBusy=false;});
},30_000);
pushTimer.unref();
// Dispatch on boot too, so pending notifications survive application restarts.
void pushDispatcher.run().catch(error=>console.error(JSON.stringify({
  event:"push_dispatch_startup_failed",message:error instanceof Error?error.message:String(error),
})));

const timetableRepository = new DrizzleTimetableRepository(db);
const timetable = new TimetableService(timetableRepository);
const bookingRepository = new DrizzleBookingRepository(db);
const booking = new BookingService(bookingRepository, undefined, notificationService, timetable);
const marketingRepository = new DrizzleMarketingRepository(db);
const marketing = new MarketingService(marketingRepository, booking, undefined, notificationService);
const mediaLifecycleTimer = setInterval(() => {
  void marketing.refreshScheduledMedia().catch((error) => {
    console.error(JSON.stringify({
      event: "media_lifecycle_refresh_failed",
      message: error instanceof Error ? error.message : String(error),
    }));
  });
}, 60_000);
mediaLifecycleTimer.unref();
const teamRepository = new DrizzleTeamRepository(db);
const teamService = new TeamService(teamRepository, undefined, notificationService);
const competitionRepository = new DrizzleCompetitionRepository(db);
const competitionService = new CompetitionService(competitionRepository, undefined, notificationService);
const commercialRepository = new DrizzleCommercialRepository(db);
const commercialService = new CommercialService(commercialRepository);
const trustService=new AdminTrustService(db);
const trustTimer=setInterval(()=>{
  void trustService.dispatchDue().catch(e=>console.error(JSON.stringify({
    event:"admin_announcement_dispatch_error",message:e instanceof Error?e.message:String(e),
  })));
},60_000);
trustTimer.unref();
const owner = new OwnerOnboardingService(
  ownerRepository,
  undefined,
  async () => ((await commercialRepository.getSettings())?.trialDurationHours ?? 72) * 60 * 60 * 1000,
);
const app = createApp({
  authService: auth,
  tokenService: tokens,
  ownerService: owner,
  bookingService: booking,
  marketingService: marketing,
  notificationService,
  teamService,
  teamSlots:new TeamSlotsService(db),
  teamManagerPhase1:new TeamManagerPhase1Service(db),
  teamManagerPhase2:new TeamManagerPhase2Service(db,undefined,notificationService),
  teamManagerPhase3:new TeamManagerPhase3Service(db,undefined,notificationService),
  playerDashboardPhase1:new PlayerDashboardPhase1Service(db,teamService),
  playerDashboardPhase2:new PlayerDashboardPhase2Service(db,teamService),
  playerDashboardPhase3:new PlayerDashboardPhase3Service(db,teamService),
  competitionService,
  refereeService:new RefereeService(db),
  refereePhase2:new RefereePhase2Service(db,competitionService,notificationService),
  refereeCareer:new RefereeCareerService(db),
  commercialService,
  adminTrustService:trustService,
  timetableService: timetable,
  manualTeamService: new ManualTeamService(db),
  trustProxyHops: env.TRUST_PROXY_HOPS,
  corsOrigin: env.CORS_ORIGIN,
  appVersion: env.APP_VERSION,
  requestLogging: env.REQUEST_LOGGING,
  readinessCheck: async () => {
    await pool.query("select 1");
  },
});

const server = app.listen(env.API_PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({
    event: "api_started",
    port: env.API_PORT,
    version: env.APP_VERSION,
    environment: env.NODE_ENV,
  }));
});
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(mediaLifecycleTimer);
  clearInterval(trustTimer);
  console.log(JSON.stringify({ event: "api_shutdown_started", signal }));

  const forceTimer = setTimeout(() => {
    console.error(JSON.stringify({ event: "api_shutdown_forced", signal }));
    server.closeAllConnections();
  }, 10_000);
  forceTimer.unref();

  server.close(async () => {
    clearTimeout(forceTimer);
    await pool.end();
    console.log(JSON.stringify({ event: "api_shutdown_complete", signal }));
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
