import { neon } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DB_URL) {
  throw new Error("DB_URL is not set");
}

export const db = process.env.LOCAL_DB
  ? pgDrizzle({ client: new Pool({ connectionString: process.env.DB_URL }), schema })
  : neonDrizzle({ client: neon(process.env.DB_URL!), schema });
