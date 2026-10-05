import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

function normalizeTlsMode(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const mode = url.searchParams.get("sslmode");
  if (mode === "prefer" || mode === "require" || mode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

export function createDatabase(databaseUrl: string) {
  const pool = new Pool({ connectionString: normalizeTlsMode(databaseUrl) });
  return { db: drizzle({ client: pool, schema }), pool };
}

export type Database = ReturnType<typeof createDatabase>["db"];
