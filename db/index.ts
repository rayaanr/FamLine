import { neon } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DB_URL) {
  throw new Error("DB_URL is not set");
}

const useLocalDb = !!process.env.LOCAL_DB;

export const db = useLocalDb
  ? pgDrizzle({ client: new Pool({ connectionString: process.env.DB_URL }), schema })
  : neonDrizzle({ client: neon(process.env.DB_URL!), schema });

/**
 * True when `db` is the neon-http driver (prod). Declared as a type predicate
 * (rather than inferred) because the branch is picked by an env var the type
 * checker can't see — callers that need driver-specific behavior (e.g. atomic
 * multi-statement writes) narrow on this before touching `db.batch`/`db.transaction`.
 */
export function isNeonHttp(
  d: typeof db,
): d is Extract<typeof db, { batch: unknown }> {
  return !useLocalDb;
}
