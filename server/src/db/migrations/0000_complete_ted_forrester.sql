CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"message" text NOT NULL,
	"reorder_url" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "allowed_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now(),
	"invited_by" uuid,
	"first_login_at" timestamp with time zone,
	"notes" text,
	CONSTRAINT "allowed_emails_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "filament_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"material" text NOT NULL,
	"material_variant" text,
	"color_name" text,
	"color_hex" text,
	"diameter_mm" numeric(4, 2) DEFAULT '1.75' NOT NULL,
	"empty_spool_weight_g" numeric(6, 1),
	"net_spool_weight_g" numeric(6, 1) DEFAULT '1000' NOT NULL,
	"cost_per_spool" numeric(8, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"reorder_url" text,
	"sku" text,
	"alert_mode" text DEFAULT 'both' NOT NULL,
	"low_gram_threshold_g" numeric(6, 1) DEFAULT '150' NOT NULL,
	"critical_gram_threshold_g" numeric(6, 1) DEFAULT '50' NOT NULL,
	"low_spool_threshold" integer DEFAULT 1 NOT NULL,
	"alert_on_last_spool" boolean DEFAULT true NOT NULL,
	"price_target" numeric(8, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "installed_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"printer_id" uuid NOT NULL,
	"printer_item_id" uuid,
	"installed_date" date,
	"hours_on_part" numeric(8, 1) DEFAULT '0',
	"replacement_interval_hrs" numeric(8, 1),
	"replaced_reason" text,
	"is_current" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kit_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit_id" uuid NOT NULL,
	"component_type" text NOT NULL,
	"workshop_item_id" uuid,
	"filament_profile_id" uuid,
	"quantity_per_build" numeric(10, 2) NOT NULL,
	"filament_grams_per_build" numeric(6, 1),
	"external_name" text,
	"external_buy_url" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "print_kits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"kits_owned" integer DEFAULT 0 NOT NULL,
	"kits_completed" integer DEFAULT 0 NOT NULL,
	"kits_in_progress" integer DEFAULT 0 NOT NULL,
	"project_url" text,
	"purchase_record_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "printer_accessories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"printer_id" uuid NOT NULL,
	"accessory_type" text NOT NULL,
	"brand" text,
	"model" text,
	"unit_index" integer DEFAULT 1,
	"slots_added" integer DEFAULT 0,
	"drying_capable" boolean DEFAULT false,
	"rfid_capable" boolean DEFAULT false,
	"max_dry_temp_c" integer,
	"installed_date" date,
	"purchase_record_id" uuid,
	"is_installed" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "printer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"printer_id" uuid,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"spec" jsonb,
	"quantity_in_stock" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 1 NOT NULL,
	"reorder_url" text,
	"purchase_record_id" uuid,
	"storage_location" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "printers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"nickname" text,
	"printer_type" text DEFAULT 'FDM' NOT NULL,
	"motion_system" text,
	"build_volume_x_mm" integer,
	"build_volume_y_mm" integer,
	"build_volume_z_mm" integer,
	"max_nozzle_temp_c" integer,
	"max_bed_temp_c" integer,
	"has_enclosure" boolean DEFAULT false NOT NULL,
	"filament_diameter_mm" numeric(4, 2) DEFAULT '1.75' NOT NULL,
	"direct_drive" boolean DEFAULT false NOT NULL,
	"current_nozzle_diameter_mm" numeric(4, 2) DEFAULT '0.4' NOT NULL,
	"current_nozzle_material" text DEFAULT 'brass' NOT NULL,
	"multi_color_system" text,
	"native_color_slots" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"purchase_date" date,
	"purchase_record_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"component_name" text NOT NULL,
	"component_type" text,
	"bambu_sku" text,
	"qty_required" numeric(10, 2),
	"inventory_item_id" uuid,
	"inventory_item_type" text,
	"inventory_status" text,
	"affiliate_amazon_url" text,
	"affiliate_bambu_url" text,
	"affiliate_ali_url" text,
	"user_confirmed" boolean DEFAULT false,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "purchase_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"item_ref_id" uuid,
	"purchase_date" date NOT NULL,
	"quantity" integer DEFAULT 1,
	"price_per_unit" numeric(10, 2),
	"total_paid" numeric(10, 2),
	"currency" text DEFAULT 'USD',
	"source_id" uuid,
	"product_url" text,
	"product_title" text,
	"order_id" text,
	"was_on_sale" boolean DEFAULT false,
	"coupon_code" text,
	"is_secondhand" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"source_type" text,
	"is_official" boolean DEFAULT false,
	"reliability_note" text,
	"shipping_note" text,
	"affiliate_program" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"item_ref_id" uuid,
	"item_ref_type" text,
	"description" text NOT NULL,
	"qty_per_unit" numeric(10, 3),
	"unit_label" text,
	"cost_per_unit_item" numeric(10, 4),
	"line_cost_per_unit" numeric(10, 4),
	"is_from_inventory" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "quote_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"saved_project_id" uuid,
	"name" text NOT NULL,
	"batch_quantity" integer DEFAULT 1 NOT NULL,
	"print_time_min" numeric(8, 1),
	"assembly_time_min" numeric(8, 1),
	"packaging_cost" numeric(8, 2) DEFAULT '0',
	"platform_fee_pct" numeric(5, 2) DEFAULT '0',
	"table_fee" numeric(8, 2) DEFAULT '0',
	"selling_venue" text DEFAULT 'other' NOT NULL,
	"target_price" numeric(8, 2),
	"status" text DEFAULT 'draft' NOT NULL,
	"units_sold" integer,
	"actual_revenue" numeric(10, 2),
	"event_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_platform" text NOT NULL,
	"source_url" text NOT NULL,
	"project_title" text,
	"designer_name" text,
	"parsed_at" timestamp with time zone,
	"raw_description" text,
	"status" text DEFAULT 'want_to_print' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "slot_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"printer_id" uuid NOT NULL,
	"accessory_id" uuid,
	"slot_number" integer NOT NULL,
	"slot_label" text,
	"spool_id" uuid,
	"filament_profile_id" uuid,
	"assigned_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "spools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" text DEFAULT 'reserve' NOT NULL,
	"purchase_date" date,
	"opened_date" date,
	"empty_date" date,
	"current_gross_weight_g" numeric(6, 1),
	"opening_gross_weight_g" numeric(6, 1),
	"storage_location" text,
	"is_in_drybox" boolean DEFAULT false NOT NULL,
	"lot_number" text,
	"purchase_record_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_quote_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"electricity_rate_per_kwh" numeric(6, 4) DEFAULT '0.14',
	"default_printer_wattage_w" integer DEFAULT 200,
	"labor_rate_per_hr" numeric(8, 2) DEFAULT '15.00',
	"include_electricity" boolean DEFAULT true,
	"include_labor" boolean DEFAULT true,
	"include_wear_costs" boolean DEFAULT true,
	"default_markup" numeric(4, 2) DEFAULT '3.0',
	"default_venue" text DEFAULT 'farmers_market',
	"default_packaging_cost" numeric(8, 2) DEFAULT '0',
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"experience_level" text DEFAULT 'beginner' NOT NULL,
	"mode" text DEFAULT 'maker' NOT NULL,
	"preferred_currency" text DEFAULT 'USD' NOT NULL,
	"preferred_language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "weight_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spool_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now(),
	"gross_weight_g" numeric(6, 1) NOT NULL,
	"event_type" text DEFAULT 'weigh' NOT NULL,
	"slicer_estimate_g" numeric(6, 1),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "workshop_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"spec" jsonb,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"low_stock_threshold" numeric(10, 2) DEFAULT '5' NOT NULL,
	"source_kit_id" uuid,
	"reorder_url" text,
	"storage_location" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filament_profiles" ADD CONSTRAINT "filament_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installed_items" ADD CONSTRAINT "installed_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installed_items" ADD CONSTRAINT "installed_items_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installed_items" ADD CONSTRAINT "installed_items_printer_item_id_printer_items_id_fk" FOREIGN KEY ("printer_item_id") REFERENCES "public"."printer_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_components" ADD CONSTRAINT "kit_components_kit_id_print_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."print_kits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_components" ADD CONSTRAINT "kit_components_workshop_item_id_workshop_items_id_fk" FOREIGN KEY ("workshop_item_id") REFERENCES "public"."workshop_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_components" ADD CONSTRAINT "kit_components_filament_profile_id_filament_profiles_id_fk" FOREIGN KEY ("filament_profile_id") REFERENCES "public"."filament_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_kits" ADD CONSTRAINT "print_kits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_kits" ADD CONSTRAINT "print_kits_purchase_record_id_purchase_records_id_fk" FOREIGN KEY ("purchase_record_id") REFERENCES "public"."purchase_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_accessories" ADD CONSTRAINT "printer_accessories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_accessories" ADD CONSTRAINT "printer_accessories_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_accessories" ADD CONSTRAINT "printer_accessories_purchase_record_id_purchase_records_id_fk" FOREIGN KEY ("purchase_record_id") REFERENCES "public"."purchase_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_items" ADD CONSTRAINT "printer_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_items" ADD CONSTRAINT "printer_items_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_items" ADD CONSTRAINT "printer_items_purchase_record_id_purchase_records_id_fk" FOREIGN KEY ("purchase_record_id") REFERENCES "public"."purchase_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printers" ADD CONSTRAINT "printers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printers" ADD CONSTRAINT "printers_purchase_record_id_purchase_records_id_fk" FOREIGN KEY ("purchase_record_id") REFERENCES "public"."purchase_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_components" ADD CONSTRAINT "project_components_project_id_saved_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."saved_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_source_id_purchase_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."purchase_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_sources" ADD CONSTRAINT "purchase_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_quote_projects_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_projects" ADD CONSTRAINT "quote_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_projects" ADD CONSTRAINT "quote_projects_saved_project_id_saved_projects_id_fk" FOREIGN KEY ("saved_project_id") REFERENCES "public"."saved_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_projects" ADD CONSTRAINT "saved_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_accessory_id_printer_accessories_id_fk" FOREIGN KEY ("accessory_id") REFERENCES "public"."printer_accessories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_spool_id_spools_id_fk" FOREIGN KEY ("spool_id") REFERENCES "public"."spools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_filament_profile_id_filament_profiles_id_fk" FOREIGN KEY ("filament_profile_id") REFERENCES "public"."filament_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spools" ADD CONSTRAINT "spools_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spools" ADD CONSTRAINT "spools_profile_id_filament_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."filament_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spools" ADD CONSTRAINT "spools_purchase_record_id_purchase_records_id_fk" FOREIGN KEY ("purchase_record_id") REFERENCES "public"."purchase_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_quote_settings" ADD CONSTRAINT "user_quote_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_spool_id_spools_id_fk" FOREIGN KEY ("spool_id") REFERENCES "public"."spools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_items" ADD CONSTRAINT "workshop_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_items" ADD CONSTRAINT "workshop_items_source_kit_id_purchase_records_id_fk" FOREIGN KEY ("source_kit_id") REFERENCES "public"."purchase_records"("id") ON DELETE no action ON UPDATE no action;