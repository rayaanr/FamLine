// Better Auth tables are generated into ./auth-schema.ts by the Better Auth CLI.
// Re-export them here so the Drizzle instance and drizzle-kit pick them up.
export * from "./auth-schema";

// App tables (family trees + per-tree membership + searchable people index).
export * from "./tree-schema";
