CREATE TABLE "parse_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"usage_date" date NOT NULL,
	"parse_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parse_usage" ADD CONSTRAINT "parse_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;