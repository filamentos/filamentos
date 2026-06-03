-- Phase 4.6: Move print time into each plate; each plate gets its own batch quantity.
-- Apply this SQL directly via the Supabase SQL Editor (per established pattern).

-- ── projects: drop old project-level print-time + batch fields ─
ALTER TABLE "projects" DROP COLUMN IF EXISTS "time_mode";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "print_time_min_per_unit";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "units_per_plate";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "full_plate_time_min";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "partial_plate_time_min";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "batch_quantity";

-- ── projects: add units_produced (selling section) ─────────────
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "units_produced" integer DEFAULT 1 NOT NULL;

-- ── project_plates: add per-plate print time + batch quantity ──
ALTER TABLE "project_plates" ADD COLUMN IF NOT EXISTS "print_time_min" numeric(8, 1);
ALTER TABLE "project_plates" ADD COLUMN IF NOT EXISTS "batch_quantity" integer DEFAULT 1 NOT NULL;
