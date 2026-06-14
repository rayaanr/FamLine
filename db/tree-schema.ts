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
import type { FamilyTree } from "@/features/family-tree/types";
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

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
 * `trees.data.people` on each save, so it is derived state — never the source
 * of truth.
 */
export const peopleIndex = pgTable(
  "people_index",
  {
    // The person's id *within its tree* — unique per tree, not globally.
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
