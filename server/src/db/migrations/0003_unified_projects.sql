-- Phase 5: Merge Projects + Quotes into one unified `projects` feature; remove parsing.
-- Apply this SQL directly via the Supabase SQL Editor (per established pattern).
-- NOTE: this DROPS all existing projects, quotes, parsed components, and parse usage.

-- ── Drop removed tables ───────────────────────────────────────
DROP TABLE IF EXISTS "parse_usage" CASCADE;
DROP TABLE IF EXISTS "project_components" CASCADE;
DROP TABLE IF EXISTS "quote_line_items" CASCADE;
DROP TABLE IF EXISTS "quote_projects" CASCADE;
DROP TABLE IF EXISTS "saved_projects" CASCADE;

-- ── New unified projects table ────────────────────────────────
CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "project_url" text,
  "platform" text DEFAULT 'other' NOT NULL,
  "status" text DEFAULT 'want_to_print' NOT NULL,
  "title" text,
  "designer" text,
  "printer_id" uuid,
  "time_mode" text DEFAULT 'per_unit' NOT NULL,
  "print_time_min_per_unit" numeric(8, 1),
  "units_per_plate" integer,
  "full_plate_time_min" numeric(8, 1),
  "partial_plate_time_min" numeric(8, 1),
  "assembly_time_min_per_unit" numeric(8, 1),
  "batch_quantity" integer DEFAULT 1 NOT NULL,
  "venue" text DEFAULT 'other' NOT NULL,
  "event_date" date,
  "packaging_cost_per_unit" numeric(8, 2) DEFAULT '0',
  "table_fee" numeric(8, 2) DEFAULT '0',
  "platform_fee_pct" numeric(5, 2) DEFAULT '0',
  "target_price" numeric(8, 2),
  "units_sold" integer,
  "actual_revenue" numeric(10, 2),
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "project_plates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "plate_number" integer DEFAULT 1 NOT NULL,
  "plate_name" text
);

CREATE TABLE IF NOT EXISTS "project_plate_colors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plate_id" uuid NOT NULL,
  "color_label" text,
  "filament_profile_id" uuid,
  "grams_used" numeric(8, 1) DEFAULT '0' NOT NULL
);

CREATE TABLE IF NOT EXISTS "project_parts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "workshop_item_id" uuid,
  "quantity_per_unit" numeric(10, 2) DEFAULT '1' NOT NULL
);

-- ── Foreign keys ──────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_printer_id_printers_id_fk"
    FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "project_plates" ADD CONSTRAINT "project_plates_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "project_plate_colors" ADD CONSTRAINT "project_plate_colors_plate_id_project_plates_id_fk"
    FOREIGN KEY ("plate_id") REFERENCES "public"."project_plates"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "project_plate_colors" ADD CONSTRAINT "project_plate_colors_filament_profile_id_filament_profiles_id_fk"
    FOREIGN KEY ("filament_profile_id") REFERENCES "public"."filament_profiles"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "project_parts" ADD CONSTRAINT "project_parts_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "project_parts" ADD CONSTRAINT "project_parts_workshop_item_id_workshop_items_id_fk"
    FOREIGN KEY ("workshop_item_id") REFERENCES "public"."workshop_items"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
