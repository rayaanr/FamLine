ALTER TABLE "trees" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "trees" ADD CONSTRAINT "trees_slug_unique" UNIQUE("slug");