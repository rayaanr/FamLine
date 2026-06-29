import { neon } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DB_URL) {
  throw new Error("DB_URL is not set");
}

const url = process.env.DB_URL;
const isLocal = url.includes("localhost") || url.includes("127.0.0.1");

export const db = isLocal
  ? pgDrizzle({ client: new Pool({ connectionString: url }), schema })
  : neonDrizzle({ client: neon(url), schema });
