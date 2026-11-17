import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  unique,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import type {
  FamilyTree,
  TreeSettings,
  MediaKind,
  DocType,
  Gender,
  CoupleStatus,
  ParentChildType,
} from "@/features/family-tree/types";
import { DEFAULT_TREE_SETTINGS } from "@/features/family-tree/types";
import { user } from "./auth-schema";

/**
 * A family tree. The graph itself (people / couples / parent-child links /
 * collapsed node ids) is stored as a single JSONB blob in `data`; the columns
 * carry only the metadata we query/sort/authorize on. `people_index` mirrors
 * the people inside `data` for cross-tree search without parsing JSON.
 */
export const trees = pgTable(
  "trees",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Monotonic version for optimistic concurrency. `applyTreeOps` bumps this on
    // every graph-mutating flush and refuses stale writes (baseVersion mismatch).
    version: integer("version").notNull().default(0),
    // Canvas collapse state (node ids). Shared per tree, last-write-wins, and
    // deliberately version-exempt so one editor collapsing a node never forces a
    // false "someone else edited" conflict on another.
    collapsed: jsonb("collapsed").$type<string[]>().notNull().default([]),
    // Tree-level settings kept in their own column so the graph autosave (which
    // overwrites `data` wholesale) never races with / clobbers them.
    settings: jsonb("settings")
      .$type<TreeSettings>()
      .notNull()
      .default(DEFAULT_TREE_SETTINGS),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("trees_owner_idx").on(table.ownerId)],
);

/**
 * A person in a tree. Ids are the same nanoid ids the client already uses
 * (unique per tree). The `unique(tree_id, id)` is the target of the composite
 * FKs on tree_couple / tree_parent_child, which makes a couple or link pointing
 * at a person in a *different* tree structurally impossible.
 */
export const treePerson = pgTable(
  "tree_person",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    birthDate: text("birth_date"),
    birthPlace: text("birth_place"),
    deathDate: text("death_date"),
    isDeceased: boolean("is_deceased").notNull().default(false),
    gender: text("gender").$type<Gender>().notNull().default("unknown"),
    notes: text("notes"),
    isPlaceholder: boolean("is_placeholder").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique("tree_person_tree_id_id_uq").on(table.treeId, table.id),
    index("tree_person_tree_idx").on(table.treeId),
    check(
      "tree_person_gender_ck",
      sql`${table.gender} in ('male','female','other','unknown')`,
    ),
  ],
);

/**
 * A couple (spouse/partner pair) in a tree. Both partners are enforced to exist
 * in the same tree via composite FKs; deleting either partner cascades the
 * couple away (matching the store's removePerson semantics).
 */
export const treeCouple = pgTable(
  "tree_couple",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    partner1Id: text("partner1_id").notNull(),
    partner2Id: text("partner2_id").notNull(),
    status: text("status").$type<CoupleStatus>().notNull(),
    startDate: text("start_date"),
    endDate: text("end_date"),
    marriagePlace: text("marriage_place"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique("tree_couple_tree_id_id_uq").on(table.treeId, table.id),
    foreignKey({
      name: "tree_couple_partner1_fk",
      columns: [table.treeId, table.partner1Id],
      foreignColumns: [treePerson.treeId, treePerson.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "tree_couple_partner2_fk",
      columns: [table.treeId, table.partner2Id],
      foreignColumns: [treePerson.treeId, treePerson.id],
    }).onDelete("cascade"),
    index("tree_couple_tree_idx").on(table.treeId),
    index("tree_couple_partner1_idx").on(table.partner1Id),
    index("tree_couple_partner2_idx").on(table.partner2Id),
    check(
      "tree_couple_distinct_partners_ck",
      sql`${table.partner1Id} <> ${table.partner2Id}`,
    ),
    check(
      "tree_couple_status_ck",
      sql`${table.status} in ('married','divorced','separated','partnered')`,
    ),
  ],
);

/**
 * A parent-child link. Exactly one of `coupleId` / `singleParentId` is set
 * (XOR enforced by CHECK). Composite FKs keep child/couple/parent in the same
 * tree and cascade on their deletion.
 */
export const treeParentChild = pgTable(
  "tree_parent_child",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    childId: text("child_id").notNull(),
    coupleId: text("couple_id"),
    singleParentId: text("single_parent_id"),
    type: text("type").$type<ParentChildType>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "tree_pc_child_fk",
      columns: [table.treeId, table.childId],
      foreignColumns: [treePerson.treeId, treePerson.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "tree_pc_couple_fk",
      columns: [table.treeId, table.coupleId],
      foreignColumns: [treeCouple.treeId, treeCouple.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "tree_pc_single_parent_fk",
      columns: [table.treeId, table.singleParentId],
      foreignColumns: [treePerson.treeId, treePerson.id],
    }).onDelete("cascade"),
    index("tree_pc_tree_idx").on(table.treeId),
    index("tree_pc_child_idx").on(table.childId),
    index("tree_pc_couple_idx").on(table.coupleId),
    index("tree_pc_single_parent_idx").on(table.singleParentId),
    check(
      "tree_pc_one_parent_ref_ck",
      sql`(${table.coupleId} is null) <> (${table.singleParentId} is null)`,
    ),
    check(
      "tree_pc_type_ck",
      sql`${table.type} in ('biological','adopted','step')`,
    ),
  ],
);

/**
 * Point-in-time snapshots of a tree's whole graph (in the legacy FamilyTree
 * shape, incl. `collapsed`). Written throttled on save (`reason: 'auto'`),
 * before a restore (`pre_restore`), and by the one-time backfill (`backfill`).
 * Retention: newest ~20 per tree. Enables owner-only restore + disaster recovery.
 */
export const treeRevision = pgTable(
  "tree_revision",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    data: jsonb("data").$type<FamilyTree>().notNull(),
    reason: text("reason").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("tree_revision_tree_created_idx").on(table.treeId, table.createdAt),
    check(
      "tree_revision_reason_ck",
      sql`${table.reason} in ('auto','backfill','pre_restore')`,
    ),
  ],
);

/**
 * A file stored in R2 (Cloudflare) belonging to a tree: a member's profile
 * photo or an identity document. We keep only metadata here - the object itself
 * lives in R2 under `key`. Deliberately a separate table (not inside the graph
 * tables) so uploads don't collide with the graph autosave.
 */
export const mediaAsset = pgTable(
  "media_asset",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    // Null for tree-level (gallery) media; otherwise the member it belongs to.
    // The composite FK below cascades member media away when the person is
    // deleted (the R2 objects are purged separately by the delete path).
    personId: text("person_id"),
    // "profile" | "document"
    kind: text("kind").$type<MediaKind>().notNull(),
    // Document category (birth_certificate | nic | passport | other); null unless kind = "document".
    docType: text("doc_type").$type<DocType>(),
    // The R2 object key (source of truth for the file).
    key: text("key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("media_asset_treeId_idx").on(table.treeId),
    index("media_asset_tree_person_idx").on(table.treeId, table.personId),
    // Covers the (treeId, personId, kind) filter used by confirmUpload's
    // "replace the existing profile photo" lookup and listProfilePhotos.
    index("media_asset_tree_person_kind_idx").on(
      table.treeId,
      table.personId,
      table.kind,
    ),
    // Member media belongs to a person in the same tree; cascades on delete.
    // MATCH SIMPLE means a null personId (gallery media) skips the check.
    foreignKey({
      name: "media_asset_person_fk",
      columns: [table.treeId, table.personId],
      foreignColumns: [treePerson.treeId, treePerson.id],
    }).onDelete("cascade"),
    check("media_asset_kind_ck", sql`${table.kind} in ('profile','document')`),
    check(
      "media_asset_doc_type_ck",
      sql`${table.docType} is null or ${table.docType} in ('birth_certificate','nic','passport','other')`,
    ),
  ],
);

/**
 * Per-tree collaborator roles. The creator's `owner` role lives on
 * `trees.ownerId`; this table holds added collaborators (`editor` / `member`,
 * and optionally co-owners). Access resolution checks both.
 */
export const treeMembership = pgTable(
  "tree_membership",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // "owner" | "editor" | "member"
    role: text("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tree_membership_tree_user_idx").on(table.treeId, table.userId),
    index("tree_membership_userId_idx").on(table.userId),
    check(
      "tree_membership_role_ck",
      sql`${table.role} in ('owner','editor','member')`,
    ),
  ],
);

export const treeInvitation = pgTable(
  "tree_invitation",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull(),
    // SHA-256 (hex) of the invite token. The plaintext is only ever in the email.
    tokenHash: text("token_hash"),
    invitedById: text("invited_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tree_invitation_token_hash_idx").on(table.tokenHash),
    index("tree_invitation_treeId_idx").on(table.treeId),
    check(
      "tree_invitation_role_ck",
      sql`${table.role} in ('owner','editor','member')`,
    ),
    // At most one pending (un-accepted) invite per (tree, email). Partial unique
    // index — hand-added in the migration SQL (drizzle-kit can't express the
    // WHERE / lower(email)); declared here for documentation only via raw SQL.
  ],
);

export const treesRelations = relations(trees, ({ one, many }) => ({
  owner: one(user, {
    fields: [trees.ownerId],
    references: [user.id],
  }),
  memberships: many(treeMembership),
  people: many(treePerson),
  couples: many(treeCouple),
  parentChildren: many(treeParentChild),
  revisions: many(treeRevision),
  media: many(mediaAsset),
}));

export const treePersonRelations = relations(treePerson, ({ one }) => ({
  tree: one(trees, {
    fields: [treePerson.treeId],
    references: [trees.id],
  }),
}));

export const treeCoupleRelations = relations(treeCouple, ({ one }) => ({
  tree: one(trees, {
    fields: [treeCouple.treeId],
    references: [trees.id],
  }),
}));

export const treeParentChildRelations = relations(
  treeParentChild,
  ({ one }) => ({
    tree: one(trees, {
      fields: [treeParentChild.treeId],
      references: [trees.id],
    }),
  }),
);

export const treeRevisionRelations = relations(treeRevision, ({ one }) => ({
  tree: one(trees, {
    fields: [treeRevision.treeId],
    references: [trees.id],
  }),
  createdByUser: one(user, {
    fields: [treeRevision.createdBy],
    references: [user.id],
  }),
}));

export const treeMembershipRelations = relations(treeMembership, ({ one }) => ({
  tree: one(trees, {
    fields: [treeMembership.treeId],
    references: [trees.id],
  }),
  user: one(user, {
    fields: [treeMembership.userId],
    references: [user.id],
  }),
}));

export const mediaAssetRelations = relations(mediaAsset, ({ one }) => ({
  tree: one(trees, {
    fields: [mediaAsset.treeId],
    references: [trees.id],
  }),
  uploader: one(user, {
    fields: [mediaAsset.uploadedBy],
    references: [user.id],
  }),
}));

export const treeInvitationRelations = relations(treeInvitation, ({ one }) => ({
  tree: one(trees, {
    fields: [treeInvitation.treeId],
    references: [trees.id],
  }),
  invitedBy: one(user, {
    fields: [treeInvitation.invitedById],
    references: [user.id],
  }),
}));
