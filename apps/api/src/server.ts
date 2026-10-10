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
import { DrizzleCommercialRepository } from "./modules/commercial/commercial.repository.js";
import { CommercialService } from "./modules/commercial/commercial.service.js";
import { DrizzleTimetableRepository } from "./modules/timetable/timetable.repository.js";
import { TimetableService } from "./modules/timetable/timetable.service.js";
import { ManualTeamService } from "./modules/manual-team/manual-team.service.js";

const { db, pool } = createDatabase(env.DATABASE_URL);
const authRepository = new DrizzleAuthRepository(db);
const tokens = new TokenService(env.ACCESS_TOKEN_SECRET, env.ACCESS_TOKEN_ISSUER, env.ACCESS_TOKEN_AUDIENCE);

async function deliverPasswordResetCode(phoneE164: string, code: string) {
  if (!env.PASSWORD_RESET_SMS_WEBHOOK_URL) return;
  const response = await fetch(env.PASSWORD_RESET_SMS_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.PASSWORD_RESET_SMS_WEBHOOK_TOKEN
        ? { Authorization: `Bearer ${env.PASSWORD_RESET_SMS_WEBHOOK_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      to: phoneE164,
      message: `Futsal password reset code: ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!response.ok) throw new Error("Password reset SMS delivery failed.");
}

const auth = new AuthService(authRepository, tokens, {
  passwordResetSecret: env.PASSWORD_RESET_SECRET,
  exposePasswordResetCode: env.NODE_ENV !== "production" && env.PASSWORD_RESET_DEV_MODE,
  ...(env.PASSWORD_RESET_SMS_WEBHOOK_URL ? { deliverPasswordResetCode } : {}),
});
tokens.setAccessValidator(async (userId) => (await authRepository.getUserById(userId))?.status ?? null);
const ownerRepository = new DrizzleOwnerOnboardingRepository(db);
const notificationRepository = new DrizzleNotificationRepository(db);
const notificationService = new NotificationService(notificationRepository);
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
  commercialService,
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
