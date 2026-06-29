import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import { migrate as neonMigrate } from "drizzle-orm/neon-http/migrator";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { migrate as pgMigrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

config({ path: ".env.local" });

if (!process.env.DB_URL) {
  throw new Error("DB_URL is not set");
}

const migrationsFolder = "./drizzle";

async function main() {
  if (process.env.LOCAL_DB) {
    const pool = new Pool({ connectionString: process.env.DB_URL });
    await pgMigrate(pgDrizzle(pool), { migrationsFolder });
    await pool.end();
  } else {
    // Neon's HTTP driver — no TCP/SSL handshake to hang the Vercel build.
    await neonMigrate(neonDrizzle(neon(process.env.DB_URL!)), { migrationsFolder });
  }
  console.log("✓ Migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
