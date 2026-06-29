CREATE TABLE "tree_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"tree_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token" text NOT NULL,
	"invited_by_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tree_invitation" ADD CONSTRAINT "tree_invitation_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_invitation" ADD CONSTRAINT "tree_invitation_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tree_invitation_token_idx" ON "tree_invitation" USING btree ("token");--> statement-breakpoint
CREATE INDEX "tree_invitation_treeId_idx" ON "tree_invitation" USING btree ("tree_id");