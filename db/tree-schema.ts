import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import type {
  FamilyTree,
  TreeSettings,
  MediaKind,
  DocType,
} from "@/features/family-tree/types";
import { DEFAULT_TREE_SETTINGS } from "@/features/family-tree/types";
import { user } from "./auth-schema";

/**
 * A family tree. The graph itself (people / couples / parent-child links /
 * collapsed node ids) is stored as a single JSONB blob in `data`; the columns
 * carry only the metadata we query/sort/authorize on. `people_index` mirrors
 * the people inside `data` for cross-tree search without parsing JSON.
 */
export const trees = pgTable("trees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<FamilyTree>().notNull(),
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
});

/**
 * A file stored in R2 (Cloudflare) belonging to a tree: a member's profile
 * photo or an identity document. We keep only metadata here - the object itself
 * lives in R2 under `key`. Deliberately a separate table (not inside
 * `trees.data`) so uploads don't collide with the graph autosave.
 */
export const mediaAsset = pgTable(
  "media_asset",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    personId: text("person_id"),
    // "profile" | "document"
    kind: text("kind").$type<MediaKind>().notNull(),
    // Document category (birth_certificate | nic | passport | other); null unless kind = "document".
    docType: text("doc_type").$type<DocType>(),
    // The R2 object key (source of truth for the file).
    key: text("key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("media_asset_treeId_idx").on(table.treeId),
    index("media_asset_tree_person_idx").on(table.treeId, table.personId),
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
  ],
);

/**
 * Denormalized, searchable index of every person in a tree. Fully rebuilt from
 * `trees.data.people` on each save, so it is derived state - never the source
 * of truth.
 */
export const peopleIndex = pgTable(
  "people_index",
  {
    // The person's id *within its tree* - unique per tree, not globally.
    id: text("id").notNull(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    personName: text("person_name").notNull(),
    birthYear: integer("birth_year"),
    gender: text("gender"),
  },
  (table) => [
    primaryKey({ columns: [table.treeId, table.id] }),
    index("people_index_treeId_idx").on(table.treeId),
  ],
);

export const treesRelations = relations(trees, ({ one, many }) => ({
  owner: one(user, {
    fields: [trees.ownerId],
    references: [user.id],
  }),
  memberships: many(treeMembership),
  people: many(peopleIndex),
  media: many(mediaAsset),
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

export const peopleIndexRelations = relations(peopleIndex, ({ one }) => ({
  tree: one(trees, {
    fields: [peopleIndex.treeId],
    references: [trees.id],
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
