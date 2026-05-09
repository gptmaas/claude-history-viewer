ALTER TABLE "messages" ADD COLUMN "search_tsvector" TSVECTOR;--> statement-breakpoint
CREATE INDEX "idx_messages_search_tsvector" ON "messages" USING GIN("search_tsvector");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE INDEX "idx_messages_search_trgm" ON "messages" USING GIN((content::text) gin_trgm_ops);--> statement-breakpoint
UPDATE "messages" SET "search_tsvector" = to_tsvector('simple', COALESCE("search_vector", '')) WHERE "search_tsvector" IS NULL;
