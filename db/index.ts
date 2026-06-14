import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DB_URL) {
  throw new Error("DB_URL is not set");
}

const sql = neon(process.env.DB_URL);

export const db = drizzle({ client: sql, schema });
