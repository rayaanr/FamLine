import "server-only";
import { z } from "zod";
import { sql, type SQL } from "drizzle-orm";
import { db, isNeonHttp } from "@/db";
import type { FamilyTree } from "@/features/family-tree/types";
import type { TreeOp } from "@/features/family-tree/types/ops";

// ── Validation ────────────────────────────────────────────────────────────────
// String caps keep a hostile/buggy client from writing unbounded blobs. `.strict()`
// rejects unknown fields so the op shape can't smuggle extra columns.

const ID = z.string().min(1).max(64);
const SHORT = z.string().max(500);
const DATE = z.string().max(64);

const zPerson = z
  .object({
    id: ID,
    firstName: z.string().max(500),
    lastName: z.string().max(500),
    birthDate: DATE.optional(),
    birthPlace: SHORT.optional(),
    deathDate: DATE.optional(),
    isDeceased: z.boolean(),
    gender: z.enum(["male", "female", "other", "unknown"]),
    notes: z.string().max(10_000).optional(),
    isPlaceholder: z.boolean().optional(),
  })
  .strict();

const zCouple = z
  .object({
    id: ID,
    partner1Id: ID,
    partner2Id: ID,
    status: z.enum(["married", "divorced", "separated", "partnered"]),
    startDate: DATE.optional(),
    endDate: DATE.optional(),
    marriagePlace: SHORT.optional(),
  })
  .strict();

const zParentChild = z
  .object({
    id: ID,
    childId: ID,
    coupleId: ID.optional(),
    singleParentId: ID.optional(),
    type: z.enum(["biological", "adopted", "step"]),
  })
  .strict();

const zOp = z.discriminatedUnion("t", [
  z.object({ t: z.literal("upsert_person"), person: zPerson }).strict(),
  z.object({ t: z.literal("delete_person"), id: ID }).strict(),
  z.object({ t: z.literal("upsert_couple"), couple: zCouple }).strict(),
  z.object({ t: z.literal("delete_couple"), id: ID }).strict(),
  z.object({ t: z.literal("upsert_parent_child"), relation: zParentChild }).strict(),
  z.object({ t: z.literal("delete_parent_child"), id: ID }).strict(),
  z.object({ t: z.literal("clear_tree") }).strict(),
  z
    .object({
      t: z.literal("set_collapsed"),
      collapsed: z.array(z.string().max(128)).max(5000),
    })
    .strict(),
]);

const MAX_OPS = 500;

/**
 * Validate a raw ops payload. Returns the typed ops or an error string. Beyond
 * the schema, enforces the two structural invariants the DB CHECKs also guard
 * (couple partners distinct, parent-child XOR) so we fail fast with a clear
 * message instead of a raw constraint violation.
 */
export function parseOps(raw: unknown): { ops: TreeOp[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "Invalid changes" };
  if (raw.length > MAX_OPS) return { error: "Too many changes at once" };
  const ops: TreeOp[] = [];
  for (const item of raw) {
    const parsed = zOp.safeParse(item);
    if (!parsed.success) return { error: "Invalid change" };
    const op = parsed.data as TreeOp;
    if (op.t === "upsert_couple" && op.couple.partner1Id === op.couple.partner2Id) {
      return { error: "A couple can't have the same person twice" };
    }
    if (op.t === "upsert_parent_child") {
      const hasCouple = op.relation.coupleId != null;
      const hasSingle = op.relation.singleParentId != null;
      if (hasCouple === hasSingle) {
        return { error: "A parent link needs exactly one parent reference" };
      }
    }
    ops.push(op);
  }
  return { ops };
}

// ── Statement builders ────────────────────────────────────────────────────────
// Every versioned statement carries `gate` — an EXISTS on the tree still being at
// `baseVersion`. Combined with running all versioned ops BEFORE the bump (which
// advances the version), this makes a stale flush a guaranteed no-op without any
// version-value ambiguity: before the bump the version is either exactly base
// (apply) or not (skip everything).

function gate(treeId: string, baseVersion: number): SQL {
  return sql`exists (select 1 from trees where id = ${treeId} and version = ${baseVersion})`;
}

const nul = (v: string | undefined | null): string | null => v ?? null;

function upsertPersonStmt(treeId: string, base: number, p: TreeOp & { t: "upsert_person" }): SQL {
  const person = p.person;
  return sql`
    insert into tree_person
      (id, tree_id, first_name, last_name, birth_date, birth_place, death_date, is_deceased, gender, notes, is_placeholder)
    select ${person.id}, ${treeId}, ${person.firstName}, ${person.lastName},
      ${nul(person.birthDate)}, ${nul(person.birthPlace)}, ${nul(person.deathDate)},
      ${person.isDeceased}, ${person.gender}, ${nul(person.notes)}, ${person.isPlaceholder ?? false}
    where ${gate(treeId, base)}
    on conflict (id) do update set
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      birth_date = excluded.birth_date,
      birth_place = excluded.birth_place,
      death_date = excluded.death_date,
      is_deceased = excluded.is_deceased,
      gender = excluded.gender,
      notes = excluded.notes,
      is_placeholder = excluded.is_placeholder,
      updated_at = now()
    where tree_person.tree_id = ${treeId}
  `;
}

function upsertCoupleStmt(treeId: string, base: number, c: TreeOp & { t: "upsert_couple" }): SQL {
  const couple = c.couple;
  return sql`
    insert into tree_couple
      (id, tree_id, partner1_id, partner2_id, status, start_date, end_date, marriage_place)
    select ${couple.id}, ${treeId}, ${couple.partner1Id}, ${couple.partner2Id},
      ${couple.status}, ${nul(couple.startDate)}, ${nul(couple.endDate)}, ${nul(couple.marriagePlace)}
    where ${gate(treeId, base)}
    on conflict (id) do update set
      partner1_id = excluded.partner1_id,
      partner2_id = excluded.partner2_id,
      status = excluded.status,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      marriage_place = excluded.marriage_place,
      updated_at = now()
    where tree_couple.tree_id = ${treeId}
  `;
}

function upsertParentChildStmt(
  treeId: string,
  base: number,
  r: TreeOp & { t: "upsert_parent_child" },
): SQL {
  const rel = r.relation;
  return sql`
    insert into tree_parent_child
      (id, tree_id, child_id, couple_id, single_parent_id, type)
    select ${rel.id}, ${treeId}, ${rel.childId}, ${nul(rel.coupleId)}, ${nul(rel.singleParentId)}, ${rel.type}
    where ${gate(treeId, base)}
    on conflict (id) do update set
      child_id = excluded.child_id,
      couple_id = excluded.couple_id,
      single_parent_id = excluded.single_parent_id,
      type = excluded.type
    where tree_parent_child.tree_id = ${treeId}
  `;
}

function deleteStmt(table: string, treeId: string, base: number, id: string): SQL {
  return sql`delete from ${sql.raw(table)} where id = ${id} and tree_id = ${treeId} and ${gate(treeId, base)}`;
}

function clearTreeStmts(treeId: string, base: number): SQL[] {
  return [
    sql`delete from tree_parent_child where tree_id = ${treeId} and ${gate(treeId, base)}`,
    sql`delete from tree_couple where tree_id = ${treeId} and ${gate(treeId, base)}`,
    sql`delete from tree_person where tree_id = ${treeId} and ${gate(treeId, base)}`,
  ];
}

function revisionStmt(
  treeId: string,
  base: number,
  id: string,
  version: number,
  data: FamilyTree,
  reason: "auto" | "backfill" | "pre_restore",
  createdBy: string | null,
): SQL {
  return sql`
    insert into tree_revision (id, tree_id, version, data, reason, created_by)
    select ${id}, ${treeId}, ${version}, ${JSON.stringify(data)}::jsonb, ${reason}, ${createdBy}
    where ${gate(treeId, base)}
  `;
}

function bumpStmt(treeId: string, base: number): SQL {
  return sql`update trees set version = version + 1, updated_at = now() where id = ${treeId} and version = ${base} returning version`;
}

function collapsedStmt(treeId: string, collapsed: string[]): SQL {
  return sql`update trees set collapsed = ${JSON.stringify(collapsed)}::jsonb where id = ${treeId}`;
}

/**
 * Turn a validated op list into an ordered statement plan, split so the caller
 * can splice in extra pre-bump work (a revision snapshot, media-row cleanup):
 *
 *   preBump  — every versioned op, each gated on `baseVersion`
 *   bump     — the single `version = version + 1` guard (null if no versioned ops)
 *   postBump — the final `set_collapsed` (ungated, LWW), if any
 *
 * Versioned ops run before the bump and gate on the *original* version, so a
 * stale flush is a guaranteed no-op with no version-value ambiguity.
 */
export function planStatements(
  treeId: string,
  base: number,
  ops: TreeOp[],
): {
  preBump: SQL[];
  bump: SQL | null;
  postBump: SQL[];
  versionedCount: number;
} {
  const preBump: SQL[] = [];
  let lastCollapsed: string[] | null = null;
  let versionedCount = 0;

  for (const op of ops) {
    switch (op.t) {
      case "upsert_person":
        preBump.push(upsertPersonStmt(treeId, base, op));
        versionedCount++;
        break;
      case "delete_person":
        preBump.push(deleteStmt("tree_person", treeId, base, op.id));
        versionedCount++;
        break;
      case "upsert_couple":
        preBump.push(upsertCoupleStmt(treeId, base, op));
        versionedCount++;
        break;
      case "delete_couple":
        preBump.push(deleteStmt("tree_couple", treeId, base, op.id));
        versionedCount++;
        break;
      case "upsert_parent_child":
        preBump.push(upsertParentChildStmt(treeId, base, op));
        versionedCount++;
        break;
      case "delete_parent_child":
        preBump.push(deleteStmt("tree_parent_child", treeId, base, op.id));
        versionedCount++;
        break;
      case "clear_tree":
        preBump.push(...clearTreeStmts(treeId, base));
        versionedCount++;
        break;
      case "set_collapsed":
        lastCollapsed = op.collapsed;
        break;
    }
  }

  return {
    preBump,
    bump: versionedCount > 0 ? bumpStmt(treeId, base) : null,
    postBump: lastCollapsed !== null ? [collapsedStmt(treeId, lastCollapsed)] : [],
    versionedCount,
  };
}

/** Gated deletes of the media_asset rows for people being removed in this flush. */
export function mediaCleanupStmts(
  treeId: string,
  base: number,
  personIds: string[],
  clearAll: boolean,
): SQL[] {
  if (clearAll) {
    return [
      sql`delete from media_asset where tree_id = ${treeId} and person_id is not null and ${gate(treeId, base)}`,
    ];
  }
  if (personIds.length === 0) return [];
  const list = sql.join(
    personIds.map((id) => sql`${id}`),
    sql`, `,
  );
  return [
    sql`delete from media_asset where tree_id = ${treeId} and person_id in (${list}) and ${gate(treeId, base)}`,
  ];
}

export { revisionStmt };

// ── Atomic execution (dual-driver) ────────────────────────────────────────────

type ExecResult = { rows?: unknown[]; rowCount?: number | null };

function rowCountOf(r: ExecResult | undefined): number {
  if (!r) return 0;
  if (Array.isArray(r.rows)) return r.rows.length;
  if (typeof r.rowCount === "number") return r.rowCount;
  return 0;
}

/**
 * Run an ordered statement plan atomically and return each statement's result.
 * neon-http has no interactive transactions, so it uses `db.batch` (one atomic
 * round-trip; statements run sequentially and see each other's writes, so
 * FK-dependent ops like add-person-then-add-couple in one flush are safe). Local
 * node-postgres uses a real transaction with the same statement list.
 */
export async function runAtomic(statements: SQL[]): Promise<ExecResult[]> {
  if (statements.length === 0) return [];
  if (isNeonHttp(db)) {
    const items = statements.map((s) => db.execute(s));
    // db.batch's type is a fixed tuple; a dynamic array is fine at runtime.
    const results = (await db.batch(
      items as unknown as [(typeof items)[number], ...(typeof items)[number][]],
    )) as unknown as ExecResult[];
    return results;
  }
  return db.transaction(async (tx) => {
    const out: ExecResult[] = [];
    for (const s of statements) {
      out.push((await tx.execute(s)) as unknown as ExecResult);
    }
    return out;
  });
}

export { rowCountOf };
