ALTER TABLE "raw_files" ADD COLUMN "machine_name" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "machine_name" varchar(255);--> statement-breakpoint
ALTER TABLE "sync_state" ADD COLUMN "machine_name" varchar(255);