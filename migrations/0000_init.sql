CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
-- Seed one placeholder row (D-05), mirroring the Phase-1 in-memory seed so the items
-- list has content on first load. drizzle-kit `generate` emits DDL only (Pitfall 1),
-- so this INSERT is appended manually and MUST stay the LAST statement in the file:
-- applyD1Migrations breaks if the final line is a comment (Pitfall 2). Fixed literal
-- UUID + ISO timestamps keep the round-trip tests deterministic.
--> statement-breakpoint
INSERT INTO `items` (`id`, `name`, `description`, `created_at`, `updated_at`) VALUES ('00000000-0000-4000-8000-000000000001', 'Example item', 'replace me', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
