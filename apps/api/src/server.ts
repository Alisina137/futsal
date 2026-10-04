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

const { db, pool } = createDatabase(env.DATABASE_URL);
const authRepository = new DrizzleAuthRepository(db);
const tokens = new TokenService(env.ACCESS_TOKEN_SECRET, env.ACCESS_TOKEN_ISSUER, env.ACCESS_TOKEN_AUDIENCE);
const auth = new AuthService(authRepository, tokens);
const ownerRepository = new DrizzleOwnerOnboardingRepository(db);
const owner = new OwnerOnboardingService(ownerRepository);
const notificationRepository = new DrizzleNotificationRepository(db);
const notificationService = new NotificationService(notificationRepository);
const bookingRepository = new DrizzleBookingRepository(db);
const booking = new BookingService(bookingRepository, undefined, notificationService);
const marketingRepository = new DrizzleMarketingRepository(db);
const marketing = new MarketingService(marketingRepository, booking, undefined, notificationService);
const teamRepository = new DrizzleTeamRepository(db);
const teamService = new TeamService(teamRepository, undefined, notificationService);
const app = createApp({
  authService: auth,
  tokenService: tokens,
  ownerService: owner,
  bookingService: booking,
  marketingService: marketing,
  notificationService,
  teamService,
  corsOrigin: env.CORS_ORIGIN,
});

const server = app.listen(env.API_PORT, "0.0.0.0", () => {
  console.log(`Futsal API listening on http://0.0.0.0:${env.API_PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
