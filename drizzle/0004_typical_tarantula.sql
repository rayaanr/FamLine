CREATE TABLE "tree_couple" (
	"id" text PRIMARY KEY NOT NULL,
	"tree_id" text NOT NULL,
	"partner1_id" text NOT NULL,
	"partner2_id" text NOT NULL,
	"status" text NOT NULL,
	"start_date" text,
	"end_date" text,
	"marriage_place" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tree_couple_tree_id_id_uq" UNIQUE("tree_id","id"),
	CONSTRAINT "tree_couple_distinct_partners_ck" CHECK ("tree_couple"."partner1_id" <> "tree_couple"."partner2_id"),
	CONSTRAINT "tree_couple_status_ck" CHECK ("tree_couple"."status" in ('married','divorced','separated','partnered'))
);
--> statement-breakpoint
CREATE TABLE "tree_parent_child" (
	"id" text PRIMARY KEY NOT NULL,
	"tree_id" text NOT NULL,
	"child_id" text NOT NULL,
	"couple_id" text,
	"single_parent_id" text,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tree_pc_one_parent_ref_ck" CHECK (("tree_parent_child"."couple_id" is null) <> ("tree_parent_child"."single_parent_id" is null)),
	CONSTRAINT "tree_pc_type_ck" CHECK ("tree_parent_child"."type" in ('biological','adopted','step'))
);
--> statement-breakpoint
CREATE TABLE "tree_person" (
	"id" text PRIMARY KEY NOT NULL,
	"tree_id" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"birth_date" text,
	"birth_place" text,
	"death_date" text,
	"is_deceased" boolean DEFAULT false NOT NULL,
	"gender" text DEFAULT 'unknown' NOT NULL,
	"notes" text,
	"is_placeholder" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tree_person_tree_id_id_uq" UNIQUE("tree_id","id"),
	CONSTRAINT "tree_person_gender_ck" CHECK ("tree_person"."gender" in ('male','female','other','unknown'))
);
--> statement-breakpoint
CREATE TABLE "tree_revision" (
	"id" text PRIMARY KEY NOT NULL,
	"tree_id" text NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tree_revision_reason_ck" CHECK ("tree_revision"."reason" in ('auto','backfill','pre_restore'))
);
--> statement-breakpoint
DROP INDEX "tree_invitation_token_idx";--> statement-breakpoint
ALTER TABLE "media_asset" ALTER COLUMN "size" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "tree_invitation" ALTER COLUMN "token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tree_invitation" ADD COLUMN "token_hash" text;--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "collapsed" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tree_couple" ADD CONSTRAINT "tree_couple_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_couple" ADD CONSTRAINT "tree_couple_partner1_fk" FOREIGN KEY ("tree_id","partner1_id") REFERENCES "public"."tree_person"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_couple" ADD CONSTRAINT "tree_couple_partner2_fk" FOREIGN KEY ("tree_id","partner2_id") REFERENCES "public"."tree_person"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_parent_child" ADD CONSTRAINT "tree_parent_child_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_parent_child" ADD CONSTRAINT "tree_pc_child_fk" FOREIGN KEY ("tree_id","child_id") REFERENCES "public"."tree_person"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_parent_child" ADD CONSTRAINT "tree_pc_couple_fk" FOREIGN KEY ("tree_id","couple_id") REFERENCES "public"."tree_couple"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_parent_child" ADD CONSTRAINT "tree_pc_single_parent_fk" FOREIGN KEY ("tree_id","single_parent_id") REFERENCES "public"."tree_person"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_person" ADD CONSTRAINT "tree_person_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_revision" ADD CONSTRAINT "tree_revision_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_revision" ADD CONSTRAINT "tree_revision_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tree_couple_tree_idx" ON "tree_couple" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "tree_couple_partner1_idx" ON "tree_couple" USING btree ("partner1_id");--> statement-breakpoint
CREATE INDEX "tree_couple_partner2_idx" ON "tree_couple" USING btree ("partner2_id");--> statement-breakpoint
CREATE INDEX "tree_pc_tree_idx" ON "tree_parent_child" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "tree_pc_child_idx" ON "tree_parent_child" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "tree_pc_couple_idx" ON "tree_parent_child" USING btree ("couple_id");--> statement-breakpoint
CREATE INDEX "tree_pc_single_parent_idx" ON "tree_parent_child" USING btree ("single_parent_id");--> statement-breakpoint
CREATE INDEX "tree_person_tree_idx" ON "tree_person" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "tree_revision_tree_created_idx" ON "tree_revision" USING btree ("tree_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tree_invitation_token_hash_idx" ON "tree_invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "trees_owner_idx" ON "trees" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_kind_ck" CHECK ("media_asset"."kind" in ('profile','document'));--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_doc_type_ck" CHECK ("media_asset"."doc_type" is null or "media_asset"."doc_type" in ('birth_certificate','nic','passport','other'));--> statement-breakpoint
ALTER TABLE "tree_invitation" ADD CONSTRAINT "tree_invitation_role_ck" CHECK ("tree_invitation"."role" in ('owner','editor','member'));--> statement-breakpoint
ALTER TABLE "tree_membership" ADD CONSTRAINT "tree_membership_role_ck" CHECK ("tree_membership"."role" in ('owner','editor','member'));--> statement-breakpoint
-- Backfill token_hash for existing pending invites so old emailed links keep working.
UPDATE "tree_invitation" SET "token_hash" = encode(sha256(convert_to("token", 'UTF8')), 'hex') WHERE "token" IS NOT NULL AND "token_hash" IS NULL;--> statement-breakpoint
-- Collapse duplicate pending invites per (tree, lower(email)), keeping the newest, before the unique index below can be created. Row-value ordering gives a total order so exactly one row per group survives even on tied created_at.
DELETE FROM "tree_invitation" a USING "tree_invitation" b WHERE a."tree_id" = b."tree_id" AND lower(a."email") = lower(b."email") AND a."accepted_at" IS NULL AND b."accepted_at" IS NULL AND (a."created_at", a."id") < (b."created_at", b."id");--> statement-breakpoint
-- At most one pending (un-accepted) invite per (tree, case-insensitive email).
CREATE UNIQUE INDEX "tree_invitation_pending_email_uq" ON "tree_invitation" (tree_id, lower(email)) WHERE accepted_at IS NULL;
