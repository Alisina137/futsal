import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../.env") });

const rawDatabaseUrl = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
if (!rawDatabaseUrl) {
  throw new Error("DATABASE_DIRECT_URL or DATABASE_URL is required to run Drizzle commands.");
}

const parsedDatabaseUrl = new URL(rawDatabaseUrl);
const sslMode = parsedDatabaseUrl.searchParams.get("sslmode");
if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
  parsedDatabaseUrl.searchParams.set("sslmode", "verify-full");
}
const databaseUrl = parsedDatabaseUrl.toString();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
