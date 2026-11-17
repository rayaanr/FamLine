ALTER TABLE "people_index" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "people_index" CASCADE;--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_person_fk" FOREIGN KEY ("tree_id","person_id") REFERENCES "public"."tree_person"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_invitation" DROP COLUMN "token";--> statement-breakpoint
ALTER TABLE "trees" DROP COLUMN "data";