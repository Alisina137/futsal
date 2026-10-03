import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("*"),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_ISSUER: z.string().default("leaguekick-api"),
  ACCESS_TOKEN_AUDIENCE: z.string().default("leaguekick-mobile"),
});

export const env = envSchema.parse(process.env);
