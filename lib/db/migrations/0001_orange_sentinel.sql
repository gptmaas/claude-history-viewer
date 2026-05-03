CREATE TABLE "raw_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"machine_id" varchar(64) NOT NULL,
	"file_path" text NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"content" text NOT NULL,
	"file_size" integer,
	"line_count" integer,
	"mtime" timestamp with time zone,
	"parsed_at" timestamp with time zone,
	"parse_version" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "machine_id" varchar(64);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "source_file_paths" text;--> statement-breakpoint
ALTER TABLE "sync_state" ADD COLUMN "machine_id" varchar(64);--> statement-breakpoint
ALTER TABLE "raw_files" ADD CONSTRAINT "raw_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_raw_files_user_machine_path" ON "raw_files" USING btree ("user_id","machine_id","file_path");--> statement-breakpoint
CREATE INDEX "idx_raw_files_unparsed" ON "raw_files" USING btree ("parsed_at") WHERE parsed_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_sessions_machine_id" ON "sessions" USING btree ("machine_id");--> statement-breakpoint
DROP INDEX IF EXISTS "idx_sync_state_user_source";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sync_state_user_source" ON "sync_state" USING btree ("user_id","source_type","machine_id");