import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });

function normalizeTlsMode(value) {
  const url = new URL(value);
  const mode = url.searchParams.get("sslmode");
  if (mode === "prefer" || mode === "require" || mode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

function safeTarget(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.port ? `:${url.port}` : ""}/${url.pathname.replace(/^\//, "")}`;
  } catch {
    return "configured PostgreSQL database";
  }
}

function errorDetails(error) {
  if (!(error instanceof Error)) return { message: String(error) };
  const candidate = error;
  return {
    name: candidate.name,
    message: candidate.message,
    ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
    ...(typeof candidate.detail === "string" ? { detail: candidate.detail } : {}),
    ...(typeof candidate.hint === "string" ? { hint: candidate.hint } : {}),
    ...(typeof candidate.schema === "string" ? { schema: candidate.schema } : {}),
    ...(typeof candidate.table === "string" ? { table: candidate.table } : {}),
    ...(typeof candidate.constraint === "string" ? { constraint: candidate.constraint } : {}),
  };
}

const rawUrl = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("Migration failed: DATABASE_DIRECT_URL or DATABASE_URL is required.");
  process.exit(1);
}

const connectionString = normalizeTlsMode(rawUrl);
const pool = new Pool({ connectionString });
const db = drizzle(pool);
const migrationsFolder = path.resolve(here, "../drizzle");

try {
  await pool.query("select 1");
  console.log(`Database connection verified: ${safeTarget(connectionString)}`);
  console.log(`Applying migrations from: ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log("Database migrations applied successfully.");
} catch (error) {
  console.error("Database migration failed.");
  console.error(JSON.stringify(errorDetails(error), null, 2));
  process.exitCode = 1;
} finally {
  await pool.end();
}
