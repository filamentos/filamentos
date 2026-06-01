# FilamentOS — Technical Specification
**Version 2.1 | Build Brief for Claude Code**

> FilamentOS is a hosted web app for 3D printer makers to manage filament inventory, printer setups, spare parts, workshop consumables, print kits, project requirements, and product pricing — with smart purchase tracking, price history, affiliate-linked buy recommendations, and a smart quote engine for makers who sell their prints.
> The name works in English (Filament + OS = operating system for your print shop) and Spanish (filamentos = filaments), targeting both English and Spanish-speaking maker communities.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Database Schema](#4-database-schema)
5. [Authentication](#5-authentication)
6. [API Routes](#6-api-routes)
7. [Feature Modules](#7-feature-modules)
8. [UI Screens](#8-ui-screens)
9. [Business Logic](#9-business-logic)
10. [Affiliate System](#10-affiliate-system)
11. [Smart Quote Engine](#11-smart-quote-engine)
12. [Reference Data](#12-reference-data-seed-data)
13. [Build Phases](#13-build-phases)
14. [Environment Variables](#14-environment-variables)
15. [Design System](#15-design-system)

---

## 1. Project Overview

### What it is
A full-stack hosted web app (PWA-ready) where makers track:
- Filament spools (by brand, material, color, weight remaining)
- Printers and their accessories (AMS, IFS, enclosures, cameras)
- Spare parts per printer (nozzles, build plates, PTFE tubes, hotend parts)
- Workshop consumables (M3 screws, tools, sandpaper, IPA, etc.)
- Print kits (Bambu lamp kits, clock kits, LED bundles)
- Purchase history with price tracking across marketplaces
- Saved MakerWorld / Printables projects with inventory readiness checks
- Smart quote engine — true cost calculator for selling printed products

### Who it's for
- Individual makers (1–3 printers)
- Print farm operators (4+ printers)
- Beginners to advanced — UI adapts to experience level

### Current phase
- **Invite-only** — magic link auth, no public signup
- No printer network integration yet (no OctoPrint, no Bambu MQTT)
- All data is manually entered
- Affiliate links on buy recommendations

### Future phases
- Public signup + Stripe subscriptions
- Community filament price database
- MakerWorld URL parser + project inventory checker
- Printer network API integration

---

## 2. Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | React 18 + Vite | Fast dev, huge ecosystem |
| Styling | TailwindCSS | Consistent, mobile-first |
| Backend | Node.js + Hono | Lightweight, fast, modern |
| Database | PostgreSQL via Supabase | Free tier, great dashboard, scales to SaaS |
| Auth | Magic links via Resend | No passwords, invite-only phase |
| Email | Resend | Transactional email for magic links |
| Hosting | Vercel | GitHub push deploy, free tier, custom domain, auto SSL |
| PWA | vite-plugin-pwa | Installable on phone homescreen |
| ORM | Drizzle ORM | TypeScript-native, lightweight |

---

## 3. Folder Structure

```
filamentos/
├── client/                          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                  # Shared UI components
│   │   │   ├── filament/            # Filament-specific components
│   │   │   ├── printer/             # Printer-specific components
│   │   │   ├── workshop/            # Workshop/tools components
│   │   │   ├── kits/                # Print kit components
│   │   │   └── projects/            # Saved project components
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Filament.tsx
│   │   │   ├── FilamentDetail.tsx
│   │   │   ├── Printers.tsx
│   │   │   ├── PrinterDetail.tsx
│   │   │   ├── Workshop.tsx
│   │   │   ├── Kits.tsx
│   │   │   ├── Projects.tsx
│   │   │   ├── Purchases.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── Login.tsx
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── lib/                     # Utilities, API client
│   │   ├── stores/                  # Zustand state stores
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   └── vite.config.ts
│
├── server/                          # Hono backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── filament.ts
│   │   │   ├── printers.ts
│   │   │   ├── spools.ts
│   │   │   ├── workshop.ts
│   │   │   ├── kits.ts
│   │   │   ├── projects.ts
│   │   │   ├── purchases.ts
│   │   │   └── alerts.ts
│   │   ├── db/
│   │   │   ├── schema.ts            # Drizzle schema
│   │   │   ├── migrations/
│   │   │   └── seed/                # Reference data seeds
│   │   ├── lib/
│   │   │   ├── auth.ts              # Magic link logic
│   │   │   ├── email.ts             # Resend integration
│   │   │   ├── alerts.ts            # Alert evaluation
│   │   │   ├── compatibility.ts     # Printer/filament compat
│   │   │   └── affiliate.ts         # Affiliate URL builder
│   │   └── index.ts
│   └── package.json
│
├── shared/                          # Shared types between client/server
│   └── types.ts
│
├── PLANNING.md                      # This file — keep updated
└── README.md
```

---

## 4. Database Schema

### Users & Auth

```sql
-- Allowlist (invite-only phase)
allowed_emails (
  id uuid PK,
  email text UNIQUE NOT NULL,
  invited_at timestamptz DEFAULT now(),
  invited_by uuid REFERENCES users(id),
  first_login_at timestamptz,
  notes text
)

-- Users
users (
  id uuid PK DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  display_name text,
  experience_level text DEFAULT 'beginner', -- beginner | casual | pro
  mode text DEFAULT 'maker',                -- maker | farm
  preferred_currency text DEFAULT 'USD',
  preferred_language text DEFAULT 'en',     -- en | es
  created_at timestamptz DEFAULT now()
)

-- Magic link sessions
magic_links (
  id uuid PK,
  email text NOT NULL,
  token_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
)

-- Sessions
sessions (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz
)
```

### Purchase Sources

```sql
-- Marketplace / source catalog (pre-seeded + user-addable)
purchase_sources (
  id uuid PK,
  name text NOT NULL,               -- "Amazon", "Bambu Lab", "AliExpress"
  domain text,                      -- "amazon.com", "bambulab.com"
  source_type text,                 -- official | marketplace | discount | local
  is_official bool DEFAULT false,
  reliability_note text,            -- shown to user
  shipping_note text,               -- shown to user
  affiliate_program text,           -- amazon_associates | bambu | aliexpress | none
  user_id uuid REFERENCES users(id), -- null = pre-seeded global
  created_at timestamptz DEFAULT now()
)

-- Purchase records (applies to filament, parts, kits, tools — everything)
purchase_records (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  item_type text NOT NULL,          -- filament_spool | printer_part | addon | workshop_item | print_kit | printer
  item_ref_id uuid,                 -- polymorphic FK to the item
  purchase_date date NOT NULL,
  quantity integer DEFAULT 1,
  price_per_unit numeric(10,2),
  total_paid numeric(10,2),
  currency text DEFAULT 'USD',
  source_id uuid REFERENCES purchase_sources(id),
  product_url text,
  product_title text,
  order_id text,
  was_on_sale bool DEFAULT false,
  coupon_code text,
  is_secondhand bool DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
)
```

### Filament

```sql
-- Filament profiles (the product — brand + material + color)
filament_profiles (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  brand text NOT NULL,
  material text NOT NULL,           -- PLA | PETG | ABS | ASA | TPU | Nylon | PC | etc.
  material_variant text,            -- PLA+ | Silk | Matte | Galaxy | Carbon Fiber | etc.
  color_name text,
  color_hex text,                   -- for swatch display
  diameter_mm numeric(4,2) DEFAULT 1.75,
  empty_spool_weight_g numeric(6,1),
  net_spool_weight_g numeric(6,1) DEFAULT 1000,
  cost_per_spool numeric(8,2),
  currency text DEFAULT 'USD',
  reorder_url text,
  sku text,
  -- Alert settings
  alert_mode text DEFAULT 'both',   -- gram | spool | both | off
  low_gram_threshold_g numeric(6,1) DEFAULT 150,
  critical_gram_threshold_g numeric(6,1) DEFAULT 50,
  low_spool_threshold integer DEFAULT 1,
  alert_on_last_spool bool DEFAULT true,
  -- Price target for drop alerts
  price_target numeric(8,2),
  notes text,
  created_at timestamptz DEFAULT now()
)

-- Individual physical spools
spools (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES filament_profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'reserve',    -- active | reserve | partial_reserve | empty | archived
  purchase_date date,
  opened_date date,
  empty_date date,
  current_gross_weight_g numeric(6,1),
  opening_gross_weight_g numeric(6,1),
  storage_location text,
  is_in_drybox bool DEFAULT false,
  lot_number text,
  purchase_record_id uuid REFERENCES purchase_records(id),
  notes text,
  created_at timestamptz DEFAULT now()
)

-- Weight log entries per spool
weight_logs (
  id uuid PK,
  spool_id uuid REFERENCES spools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  logged_at timestamptz DEFAULT now(),
  gross_weight_g numeric(6,1) NOT NULL,
  event_type text DEFAULT 'weigh',  -- open | weigh | pre_print | post_print | empty
  slicer_estimate_g numeric(6,1),   -- optional slicer estimate before print
  notes text
)
```

### Printers

```sql
-- Printer records
printers (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  brand text NOT NULL,
  model text NOT NULL,
  nickname text,
  printer_type text DEFAULT 'FDM',  -- FDM | MSLA | SLA
  motion_system text,               -- CoreXY | bedslinger | delta
  build_volume_x_mm integer,
  build_volume_y_mm integer,
  build_volume_z_mm integer,
  max_nozzle_temp_c integer,
  max_bed_temp_c integer,
  has_enclosure bool DEFAULT false,
  filament_diameter_mm numeric(4,2) DEFAULT 1.75,
  direct_drive bool DEFAULT false,
  -- Current nozzle (installed)
  current_nozzle_diameter_mm numeric(4,2) DEFAULT 0.4,
  current_nozzle_material text DEFAULT 'brass', -- brass | hardened_steel | ruby | stainless
  -- Multi-color system
  multi_color_system text,          -- IFS | none (built-in systems)
  native_color_slots integer DEFAULT 0,
  -- Status
  status text DEFAULT 'active',     -- active | idle | maintenance | retired
  purchase_date date,
  purchase_record_id uuid REFERENCES purchase_records(id),
  notes text,
  created_at timestamptz DEFAULT now()
)

-- Accessories attached to printers
printer_accessories (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  printer_id uuid REFERENCES printers(id) ON DELETE CASCADE,
  accessory_type text NOT NULL,     -- AMS | AMS_2_Pro | AMS_Lite | AMS_HT | enclosure | camera | LED | other
  brand text,
  model text,
  unit_index integer DEFAULT 1,     -- for chained AMS units
  slots_added integer DEFAULT 0,
  drying_capable bool DEFAULT false,
  rfid_capable bool DEFAULT false,
  max_dry_temp_c integer,
  installed_date date,
  purchase_record_id uuid REFERENCES purchase_records(id),
  is_installed bool DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
)

-- Filament slot assignments per printer/accessory
slot_assignments (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  printer_id uuid REFERENCES printers(id) ON DELETE CASCADE,
  accessory_id uuid REFERENCES printer_accessories(id), -- null = built-in slot
  slot_number integer NOT NULL,
  slot_label text,
  spool_id uuid REFERENCES spools(id),  -- null = empty slot
  filament_profile_id uuid REFERENCES filament_profiles(id),
  assigned_at timestamptz DEFAULT now()
)
```

### Printer Parts Inventory

```sql
-- Spare parts stock (what's in the drawer)
printer_items (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  printer_id uuid REFERENCES printers(id), -- null = shared across fleet
  category text NOT NULL,           -- nozzle | build_plate | addon | tube | hotend | consumable | motion | electronics
  name text NOT NULL,
  brand text,
  spec jsonb,                       -- {diameter: 0.4, material: "hardened_steel", length_mm: null}
  quantity_in_stock integer DEFAULT 0,
  low_stock_threshold integer DEFAULT 1,
  reorder_url text,
  purchase_record_id uuid REFERENCES purchase_records(id),
  storage_location text,
  notes text,
  created_at timestamptz DEFAULT now()
)

-- Installed parts tracking (what's currently in the printer)
installed_items (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  printer_id uuid REFERENCES printers(id) ON DELETE CASCADE,
  printer_item_id uuid REFERENCES printer_items(id),
  installed_date date,
  hours_on_part numeric(8,1) DEFAULT 0,
  replacement_interval_hrs numeric(8,1),
  replaced_reason text,             -- worn | broken | upgrade | preventive
  is_current bool DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
)
```

### Workshop Inventory

```sql
-- Workshop items (hardware, tools, consumables)
workshop_items (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL,           -- fastener | tool_durable | tool_consumable | hardware | electronic | other
  name text NOT NULL,
  spec jsonb,                       -- {size: "M3x8", material: "stainless", head_type: "socket"}
  unit text DEFAULT 'pcs',          -- pcs | roll | sheet | set | g | ml | m
  quantity numeric(10,2) DEFAULT 0,
  low_stock_threshold numeric(10,2) DEFAULT 5,
  source_kit_id uuid REFERENCES purchase_records(id), -- if came from an assortment kit
  reorder_url text,
  storage_location text,
  notes text,
  created_at timestamptz DEFAULT now()
)
```

### Print Kits

```sql
-- Print kit records
print_kits (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,               -- "Bambu Lamp Kit MH001"
  brand text,
  kits_owned integer DEFAULT 0,
  kits_completed integer DEFAULT 0,
  kits_in_progress integer DEFAULT 0,
  project_url text,                 -- MakerWorld link
  purchase_record_id uuid REFERENCES purchase_records(id),
  notes text,
  created_at timestamptz DEFAULT now()
)

-- Components required per kit build
kit_components (
  id uuid PK,
  kit_id uuid REFERENCES print_kits(id) ON DELETE CASCADE,
  component_type text NOT NULL,     -- filament | workshop_item | external
  workshop_item_id uuid REFERENCES workshop_items(id), -- null if filament or external
  filament_profile_id uuid REFERENCES filament_profiles(id), -- null if not filament
  quantity_per_build numeric(10,2) NOT NULL,
  filament_grams_per_build numeric(6,1),
  external_name text,               -- for items not in inventory yet
  external_buy_url text,
  notes text
)
```

### Saved Projects

> **MERGED in v2.1:** Projects and Quotes are now ONE unified feature. A project always shows
> its cost-to-print, and the selling/pricing details live in a collapsible section on the same
> record. URL parsing was removed entirely (MakerWorld/Cloudflare blocked it; only 1 of 4 sites
> allowed it — not worth maintaining). The old `saved_projects`, `project_components`,
> `quote_projects`, and `quote_line_items` tables are replaced by the structure below.

```sql
-- Unified projects (replaces saved_projects + quote_projects)
projects (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  -- Identity
  project_url text,
  platform text,                    -- makerworld | printables | thingiverse | cults3d | other
  status text DEFAULT 'want_to_print', -- want_to_print | printing | completed
  title text NOT NULL,
  designer text,
  -- Printer (nullable; auto-set if user has exactly 1 printer)
  printer_id uuid REFERENCES printers(id),
  -- Print time
  time_mode text DEFAULT 'per_unit', -- per_unit | per_plate
  print_time_min_per_unit numeric(8,1),     -- used when time_mode = per_unit
  units_per_plate integer,                  -- used when time_mode = per_plate
  full_plate_time_min numeric(8,1),         -- time for one full plate
  partial_plate_time_min numeric(8,1),      -- user-entered from slicer when batch doesn't divide evenly
  -- Assembly
  assembly_time_min_per_unit numeric(8,1) DEFAULT 0,
  -- Selling section (optional)
  batch_quantity integer DEFAULT 1,
  venue text,                       -- farmers_market | etsy | local | convention | other
  event_date date,
  packaging_cost_per_unit numeric(8,2) DEFAULT 0,
  table_fee numeric(8,2) DEFAULT 0,
  platform_fee_pct numeric(5,2) DEFAULT 0,
  target_price numeric(8,2),
  units_sold integer,
  actual_revenue numeric(10,2),
  notes text,
  created_at timestamptz DEFAULT now()
)

-- Plates within a project (Owl Lamp = 2 plates: "Body", "Back")
project_plates (
  id uuid PK,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  plate_number integer NOT NULL,
  plate_name text,                  -- "Body", "Back", etc.
  sort_order integer DEFAULT 0
)

-- Colors within a plate, each maps to a filament + grams (per single unit)
project_plate_colors (
  id uuid PK,
  plate_id uuid REFERENCES project_plates(id) ON DELETE CASCADE,
  color_label text,                 -- "Black", "White", etc.
  filament_profile_id uuid REFERENCES filament_profiles(id),
  grams_used numeric(6,1) NOT NULL  -- grams of this color per single unit
)

-- Non-filament parts a project needs (per single unit)
project_parts (
  id uuid PK,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  workshop_item_id uuid REFERENCES workshop_items(id),
  quantity_per_unit numeric(10,2) NOT NULL
)
```

### Alerts

```sql
-- Alert log
alerts (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  alert_type text NOT NULL,         -- low_gram | critical_gram | low_spool | last_spool | low_part | wear_reminder | low_workshop | missing_kit_component
  severity text DEFAULT 'warning',  -- info | warning | critical
  entity_type text,                 -- spool | filament_profile | printer_item | workshop_item | installed_item
  entity_id uuid,
  message text NOT NULL,
  reorder_url text,
  is_read bool DEFAULT false,
  is_dismissed bool DEFAULT false,
  created_at timestamptz DEFAULT now()
)
```

---

## 5. Authentication

### Magic Link Flow

1. User visits app → sees email input (no signup form)
2. User enters email → POST `/api/auth/request-link`
3. Server checks `allowed_emails` table
   - Not found → return 200 but send no email (don't reveal allowlist)
   - Found → generate secure random token, hash it, store in `magic_links`, send email via Resend
4. User clicks link → GET `/api/auth/verify?token=xxx`
5. Server finds token, checks expiry (15 min), marks used
6. Creates session, sets httpOnly cookie
7. Redirect to dashboard

### Opening Signups (future)
- Remove the `allowed_emails` check
- Auto-create user on first magic link verification
- Everything else stays identical

### Session Management
- httpOnly cookie, 30-day expiry
- Refresh on activity
- All API routes protected by session middleware

---

## 6. API Routes

### Auth
```
POST   /api/auth/request-link        Request magic link
GET    /api/auth/verify              Verify token, create session
POST   /api/auth/logout              Clear session
GET    /api/auth/me                  Get current user
```

### Filament
```
GET    /api/filament/profiles        List all profiles
POST   /api/filament/profiles        Create profile
GET    /api/filament/profiles/:id    Get profile + spools
PATCH  /api/filament/profiles/:id    Update profile
DELETE /api/filament/profiles/:id    Delete profile

GET    /api/filament/spools          List all spools (optionally filter by profile)
POST   /api/filament/spools          Add spool to profile
PATCH  /api/filament/spools/:id      Update spool (status, weight, etc.)
POST   /api/filament/spools/:id/weigh  Log a weight entry
POST   /api/filament/spools/:id/swap   Mark empty + promote next reserve
GET    /api/filament/spools/:id/logs   Weight log history
```

### Printers
```
GET    /api/printers                 List all printers
POST   /api/printers                 Add printer
GET    /api/printers/:id             Get printer + accessories + slots
PATCH  /api/printers/:id             Update printer
DELETE /api/printers/:id             Delete printer

POST   /api/printers/:id/accessories       Add accessory
PATCH  /api/printers/:id/accessories/:aid  Update accessory
DELETE /api/printers/:id/accessories/:aid  Remove accessory

GET    /api/printers/:id/slots             Get all slot assignments
PATCH  /api/printers/:id/slots/:slot       Assign/unassign spool to slot

GET    /api/printers/:id/items             Get spare parts inventory
POST   /api/printers/:id/items             Add spare part
PATCH  /api/printers/:id/items/:iid        Update quantity/details
POST   /api/printers/:id/items/:iid/install  Mark as installed
```

### Workshop
```
GET    /api/workshop                 List all workshop items
POST   /api/workshop                 Add item
PATCH  /api/workshop/:id             Update item (quantity, etc.)
DELETE /api/workshop/:id             Delete item
POST   /api/workshop/import-kit      Import assortment kit (creates multiple items)
```

### Print Kits
```
GET    /api/kits                     List all kits
POST   /api/kits                     Add kit
GET    /api/kits/:id                 Get kit + components + readiness check
PATCH  /api/kits/:id                 Update kit
POST   /api/kits/:id/build           Mark a build complete (deducts components)
POST   /api/kits/:id/components      Add component to kit
PATCH  /api/kits/:id/components/:cid Update component
```

### Projects
```
GET    /api/projects                 List saved projects
POST   /api/projects                 Save project (with URL parse attempt)
GET    /api/projects/:id             Get project + components + inventory check
POST   /api/projects/:id/reparse     Re-fetch and re-parse project URL
PATCH  /api/projects/:id/components/:cid  User confirms/corrects a parsed component
```

### Purchases
```
GET    /api/purchases                List purchase history
POST   /api/purchases                Log a purchase
GET    /api/purchases/sources        List purchase sources
POST   /api/purchases/sources        Add custom source
GET    /api/purchases/price-history/:itemType/:itemId  Price history for an item
```

### Alerts
```
GET    /api/alerts                   Get active alerts
POST   /api/alerts/:id/read          Mark read
POST   /api/alerts/:id/dismiss       Dismiss alert
POST   /api/alerts/evaluate          Manually trigger alert evaluation (cron calls this)
```

### Quotes
```
GET    /api/quotes                   List all saved quotes
POST   /api/quotes                   Create new quote
GET    /api/quotes/:id               Get quote + line items + calculated totals
PATCH  /api/quotes/:id               Update quote settings (batch qty, venue, price)
DELETE /api/quotes/:id               Delete quote
POST   /api/quotes/:id/line-items    Add line item to quote
PATCH  /api/quotes/:id/line-items/:lid  Update line item
DELETE /api/quotes/:id/line-items/:lid  Remove line item
GET    /api/quotes/:id/inventory-check  Check if enough stock for batch qty
POST   /api/quotes/:id/complete      Mark batch as sold — log actual units sold + revenue
GET    /api/quotes/settings          Get user quote settings (labor rate, electricity, etc.)
PATCH  /api/quotes/settings          Update user quote settings
```

---

## 7. Feature Modules

### Filament Weight Tracking
- Always store **gross weight** (scale reading) — never calculated weight
- `filament_remaining_g = current_gross_weight_g - profile.empty_spool_weight_g`
- Cost per gram = `cost_per_spool / net_spool_weight_g`
- Value remaining = `filament_remaining_g × cost_per_gram`
- Moisture warning: if `opened_date` is set and material is hygroscopic and `is_in_drybox = false`, calculate days exposed and warn after threshold (Nylon: 1 day, PETG: 3 days, PLA: 7 days)

### Spool Swap Flow
When user triggers swap on active spool:
1. Log final weight if provided
2. Set old spool: `status = 'empty'`, `empty_date = now()`
3. Calculate `actual_empty_weight = final_gross - filament_remaining` and offer to update brand default
4. Find next reserve spool (oldest `purchase_date` with `status = 'reserve'` or `'partial_reserve'`)
5. Set new spool: `status = 'active'`, `opened_date = now()`
6. Log opening weight if provided
7. Re-evaluate alerts for the profile

### Alert Evaluation
Run on every weight log, spool swap, quantity update, and on a daily cron.

**Filament alerts:**
- `filament_remaining_g <= profile.critical_gram_threshold_g` → CRITICAL
- `filament_remaining_g <= profile.low_gram_threshold_g` → WARNING
- `reserve_count <= profile.low_spool_threshold` → WARNING
- `reserve_count == 0 AND active spool just opened` → CRITICAL (last spool)

**Parts alerts:**
- `quantity_in_stock <= low_stock_threshold` → WARNING
- `quantity_in_stock == 0` → CRITICAL
- `installed_item.hours_on_part >= replacement_interval_hrs × 0.9` → INFO (approaching)
- `installed_item.hours_on_part >= replacement_interval_hrs` → WARNING (due)

**Workshop alerts:**
- Same quantity logic as parts

**Kit alerts:**
- Any `kit_component` where linked inventory is below `quantity_per_build × kits_in_progress` → WARNING

### Printer Compatibility Check
When user assigns filament to a printer slot, check:
- `filament.diameter_mm == printer.filament_diameter_mm`
- `material.nozzle_min_temp <= printer.max_nozzle_temp`
- `material.bed_min_temp <= printer.max_bed_temp`
- If `material.requires_enclosure == true` and `printer.has_enclosure == false` → WARN
- If `material.is_abrasive == true` and `printer.current_nozzle_material == 'brass'` → WARN
- AMS Lite → only A1 / A1 Mini printers
- AMS 2 Pro → all Bambu printers
- TPU in standard AMS → WARN (IFS on AD5X is fine)

### Project URL Parser (Phase 2)
Server-side fetch of project pages (avoids bot detection).
1. Fetch HTML from MakerWorld URL
2. Extract description text, tags, hardware mentions
3. POST description to Claude API: `"Extract all hardware components, electronic parts, screw sizes, and Bambu product SKUs from this 3D print project description. Return JSON array of {name, type, qty, bambu_sku}."`
4. Match each component against user's inventory
5. Build affiliate buy links for missing items

---

## 8. UI Screens

### Dashboard
- Alert banner (active warnings/critical alerts)
- Fleet overview (each printer as a card with status)
- Filament quick view (low stock profiles highlighted)
- Recent weight logs
- Quick action buttons: Log weight, Spool swap, Add purchase

### Filament Inventory (`/filament`)
- Filter by material, brand, status
- Profile cards with color swatch, remaining % bar, reserve count badges
- Expand to see individual spools
- "Log weight" button per active spool → weight entry modal
- "Spool swap" button → swap flow modal

### Printer Detail (`/printers/:id`)
- Printer specs card
- AMS/IFS slot grid (visual, color swatches showing loaded spools)
- Addons list (installed accessories)
- Spare parts inventory table with quantity + alert badges
- Installed items log (nozzle history, etc.)

### Workshop (`/workshop`)
- Grouped by category: Fasteners / Tools / Hardware / Consumables
- Search + filter
- Assortment kit import wizard
- Quantity adjustment inline

### Print Kits (`/kits`)
- Kit cards with progress (owned / completed / in-progress)
- Readiness indicator per kit (green = have everything, red = missing items)
- Component checklist with inventory status
- "Start build" button → deducts components from workshop inventory

### Saved Projects (`/projects`)
- URL input → parses project
- Project card with inventory readiness score
- Component list: green (have it) / yellow (low) / red (missing)
- Buy links for missing items (affiliate tagged)

### Purchases (`/purchases`)
- Full purchase history timeline
- Filter by item type, source, date range
- Price history chart per item
- Total spend dashboard (by category, by printer, by month)

### Settings (`/settings`)
- Profile: name, experience level, mode (maker/farm)
- Alert preferences
- Allowlist management (admin: add/remove invited emails)
- Currency preference
- Language preference (en/es)
- Quote settings: electricity rate, printer wattage, labor rate, default markup, default venue

### Quotes (`/quotes`)
- List of saved quotes with status badges (draft / confirmed / sold out / partial)
- "New quote" button → quote builder wizard
- Quote detail: full cost breakdown, pricing tiers, inventory check
- Post-event logging: units sold, actual revenue, notes

---

## 9. Business Logic

### Empty Spool Weight Calibration
When a spool is marked empty with a final weight logged:
- `variance = logged_weight - profile.empty_spool_weight_g`
- If `|variance| > 10g` → prompt user to update brand default
- If `|variance| <= 5g` → silently average into brand record

### Cost Per Print Estimate
- Grams used (from weight log delta) × `profile.cost_per_spool / net_spool_weight_g`
- Optional: add prorated wear cost for nozzle hours

### Consumption Rate
- From weight log history: `avg grams per day = total used / days since opened`
- Projected empty date: `current_remaining / avg_grams_per_day`

### Print Feasibility Warning
Before starting a print (optional):
- User enters slicer estimate (grams)
- App checks `spool.filament_remaining_g >= slicer_estimate + 10g buffer`
- If not → warn "this spool may not be enough"

---

## 10. Affiliate System

### Programs to enroll in
1. **Amazon Associates** — amazon.com/associates — covers most items
2. **Bambu Lab Affiliate** — check bambulab.com for program
3. **AliExpress Portals** — portals.aliexpress.com

### Link generation
Function `buildAffiliateUrl(baseUrl, source)`:
- Amazon: append `?tag=YOUR_AMAZON_TAG`
- Bambu: append affiliate parameter per their program spec
- AliExpress: use their link builder API

### Disclosure
Every page with affiliate links shows:
> "FilamentOS may earn a small commission if you purchase through these links, at no extra cost to you."

### FTC compliance
- Disclosure on every page that displays buy links
- Never hide affiliate nature of links
- Don't show affiliate links as "best picks" without genuine relevance

---

## 11. Smart Quote Engine → MERGED INTO PROJECTS (v2.1)

> **⚠️ ARCHITECTURE CHANGE (v2.1):** The quote engine is no longer a separate feature. It has been
> merged directly into Projects (see the unified `projects` schema in Section 4). Every project now
> automatically shows its cost-to-print, and the selling/pricing details (batch, venue, pricing
> tiers, post-event tracking) live in a collapsible "selling" section on the same project record.
> There is no separate Quotes page or sidebar item. The `quote_projects` and `quote_line_items`
> tables are removed. The cost calculation logic below still applies — it now lives in
> `server/src/lib/projectCost.ts` and reads from the project's plates/colors/parts.

### Cost Calculation (now in projectCost.ts)

Per-unit cost:
```
filament_cost = sum across all plates, all colors of:
    color.grams_used × (filament_profile cost_per_gram from latest purchase)
parts_cost = sum of: part.quantity_per_unit × part cost_per_unit

total_print_time_min:
  if time_mode = per_unit:
    print_time_min_per_unit × batch_quantity
  if time_mode = per_plate:
    full_plates = floor(batch_quantity / units_per_plate)
    remainder   = batch_quantity % units_per_plate
    total = (full_plates × full_plate_time_min)
          + (remainder > 0 ? partial_plate_time_min : 0)
    -- partial_plate_time_min is entered by the user from their slicer

electricity_cost = total_print_time_hrs × printer_wattage_kw × electricity_rate
  -- printer_wattage from project.printer_id (auto-set if user has only 1 printer)
labor_cost = ((total_print_time_min + assembly_time_min × batch_quantity) / 60) × labor_rate

cost_to_print_one   = filament_cost + parts_cost + (electricity_cost + labor_cost) / batch_quantity
cost_to_print_batch = (filament_cost + parts_cost) × batch_quantity + electricity_cost + labor_cost
```

Pricing tiers (shown only in the collapsible selling section): break_even (1×), fair (2×), market (3×), suggested (clean round-up). Plus packaging_cost_per_unit, table_fee (spread across batch), platform_fee_pct. Post-event tracking: units_sold + actual_revenue → sell-through % + advice.

**Why per-plate matters:** print time doesn't scale linearly when multiple units fit on one plate (shared heat-up, single purge, travel moves). A piece that's 45 min solo might be 6h37m for 9-on-a-plate. The user enters the actual measured plate time from their slicer rather than the app guessing. Partial plates (when batch doesn't divide evenly) get their own user-entered slicer time.

---

### ARCHIVED — original separate quote schema (no longer used, kept for reference)

The quote engine calculates the true cost to produce a batch of printed products, suggests selling prices across multiple tiers, checks if the user has enough inventory, and tracks actual sales after the event. Designed especially for beginners who want to start selling but don't know how to price their work.

### Quote Schema (ARCHIVED)

```sql
-- Quote projects (one quote = one product + batch size)
quote_projects (
  id uuid PK,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  saved_project_id uuid REFERENCES saved_projects(id), -- optional link to MakerWorld project
  name text NOT NULL,               -- "Dumpster Fire — Farmers Market Jun 2025"
  batch_quantity integer NOT NULL DEFAULT 1,
  print_time_min numeric(8,1),      -- per unit — from slicer or manual entry
  assembly_time_min numeric(8,1),   -- per unit — manual entry
  packaging_cost numeric(8,2) DEFAULT 0, -- per unit
  platform_fee_pct numeric(5,2) DEFAULT 0, -- Etsy 6.5%, etc.
  table_fee numeric(8,2) DEFAULT 0, -- farmers market table cost — spread across batch
  selling_venue text DEFAULT 'other', -- farmers_market | etsy | local | convention | custom
  target_price numeric(8,2),        -- user's chosen sell price per unit
  status text DEFAULT 'draft',      -- draft | confirmed | sold_out | partial | cancelled
  units_sold integer,               -- filled in after the event
  actual_revenue numeric(10,2),     -- filled in after the event
  event_date date,                  -- when the market/sale happens
  notes text,
  created_at timestamptz DEFAULT now()
)

-- Individual cost line items per quote
quote_line_items (
  id uuid PK,
  quote_id uuid REFERENCES quote_projects(id) ON DELETE CASCADE,
  item_type text NOT NULL,          -- filament | workshop_item | electricity | labor | packaging | platform_fee | table_fee | wear | other
  item_ref_id uuid,                 -- FK to spool or workshop_item (nullable for computed items)
  item_ref_type text,               -- spool | workshop_item | null
  description text NOT NULL,        -- "Hatchbox Fire Red PLA · 18g per unit"
  qty_per_unit numeric(10,3),       -- amount consumed per single printed item
  unit_label text,                  -- g | pcs | hrs | kWh | flat
  cost_per_unit_item numeric(10,4), -- $/g, $/piece, $/hr — sourced from purchase records
  line_cost_per_unit numeric(10,4), -- qty_per_unit × cost_per_unit_item
  is_from_inventory bool DEFAULT true, -- false = manually entered
  sort_order integer DEFAULT 0
)

-- Per-user quote settings (set once, used in all quotes)
user_quote_settings (
  user_id uuid PK REFERENCES users(id) ON DELETE CASCADE,
  electricity_rate_per_kwh numeric(6,4) DEFAULT 0.14,
  default_printer_wattage_w integer DEFAULT 200,
  labor_rate_per_hr numeric(8,2) DEFAULT 15.00,
  include_electricity bool DEFAULT true,
  include_labor bool DEFAULT true,
  include_wear_costs bool DEFAULT true,
  default_markup numeric(4,2) DEFAULT 3.0,   -- 3× = market standard
  default_venue text DEFAULT 'farmers_market',
  default_packaging_cost numeric(8,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now()
)
```

### Cost Calculation Logic

All costs computed server-side on every quote fetch. Never store computed totals — always recalculate from line items so changing a purchase price updates all quotes automatically.

```
true_cost_per_unit = SUM(all line_items.line_cost_per_unit)
  where line items include:
  - filament: grams × (spool.cost_per_spool / spool.net_weight_g)
  - workshop items: qty × (purchase_record.price_per_unit / purchase_record.quantity)
  - electricity: (print_time_hrs × printer_wattage_kw × electricity_rate)
  - labor: ((print_time_min + assembly_time_min) / 60) × labor_rate_hr
  - nozzle wear: (print_time_hrs / nozzle_replacement_interval_hrs) × nozzle_cost
  - build plate wear: 1 / plate_expected_print_count × plate_cost
  - packaging: flat per unit
  - table fee: table_fee / batch_quantity (spread evenly)

total_batch_cost = true_cost_per_unit × batch_quantity
```

### Pricing Tier Logic

Four tiers shown with explanations, dynamically labeled based on venue:

```
break_even     = true_cost_per_unit
fair_price     = true_cost_per_unit × 2.0
market_price   = true_cost_per_unit × 3.0
suggested_price = round up market_price to nearest clean number
  ($5.58 → $6.00, $8.20 → $8.50 or $9.00)

profit_at_suggested = (suggested_price - true_cost_per_unit) × batch_quantity
margin_pct = ((suggested_price - true_cost_per_unit) / suggested_price) × 100
```

### Batch Inventory Check

Before confirming a quote, verify stock is sufficient:

```
for each line_item where is_from_inventory = true:
  if item_ref_type = 'spool':
    required_g = qty_per_unit × batch_quantity
    available_g = spool.filament_remaining_g
    status = available_g >= required_g ? 'ok' : 'insufficient'

  if item_ref_type = 'workshop_item':
    required_qty = qty_per_unit × batch_quantity
    available_qty = workshop_item.quantity
    status = available_qty >= required_qty ? 'ok' : 'insufficient'

return { can_fulfill: bool, shortfalls: [{ item, required, available, gap }] }
```

### Batch Printing Optimization

Show the user how to minimize print runs:

```
units_per_plate = floor(printer.build_volume_x × printer.build_volume_y /
                        part.footprint_x × part.footprint_y)  -- estimated
print_runs = ceil(batch_quantity / units_per_plate)
actual_print_time_hrs = print_runs × print_time_per_unit_min / 60
```
User can override `units_per_plate` manually — they know their slicer layout better than an estimate.

### Post-Event Tracking

After the market/sale, user logs actual results:
- Units sold, actual revenue
- App calculates: actual profit, effective hourly rate, sell-through %
- Sell-through advice:
  - < 50% → "Consider lowering price or making fewer next time"
  - 50–85% → "Healthy sell-through — pricing looks right"
  - 85–100% → "Sold out fast — you may be priced too low, consider raising by $1–2"
  - 100% and sold out early → "Definitely price higher next time"

### Beginner Guidance (shown contextually)

These tips appear inline in the quote UI based on what the user is doing:

- **Labor rate = $0**: "Your time has value. Even 3 minutes of assembly per item adds cost. Set a rate — it keeps you honest about what you're actually earning."
- **No table fee entered + venue = farmers_market**: "Don't forget your table fee. A $40 table spread over 20 items = $2 each before you make a cent."
- **Suggested price ends in odd cents**: "Round to a clean number. $5.58 feels calculated — $6.00 feels fair. Impulse buys happen faster at clean prices."
- **target_price < fair_price**: "Warning: your selling price is below 2× cost. You'll cover materials but not your time. Are you sure?"
- **Any MakerWorld project added to quote**: "Before selling someone else's design, check the commercial license on MakerWorld. Many designers require a paid license for selling prints."
- **After event, sell-through > 95% and sold out in < 2hrs**: "You sold out fast — that's a sign your price was too low. Try $1–2 higher next time and see if demand holds."

### Folder additions for quote engine

```
client/src/
  pages/
    Quotes.tsx              # Quote list
    QuoteDetail.tsx         # Quote builder + cost breakdown
    QuoteSettings.tsx       # Electricity rate, labor rate, etc.
  components/
    quotes/
      QuoteBuilder.tsx      # Step-by-step wizard
      CostBreakdown.tsx     # Line items table
      PricingTiers.tsx      # 4-tier pricing display
      InventoryCheck.tsx    # Stock sufficiency check
      BatchOptimizer.tsx    # Plate layout / print runs
      PostEventLogger.tsx   # After-market results entry
      BeginnerTip.tsx       # Contextual advice callout

server/src/routes/
  quotes.ts                 # All quote routes

server/src/lib/
  quoteCalculator.ts        # Pure cost calculation functions
  pricingSuggestions.ts     # Tier logic + rounding
  inventoryCheck.ts         # Batch stock validation
```

---

## 12. Reference Data (Seed Data)

### Materials reference (pre-seeded)
Each material has: `name`, `variants[]`, `nozzle_min/max`, `nozzle_recommended`, `bed_min/max`, `bed_recommended`, `requires_enclosure`, `dry_before_print`, `drying_temp_c`, `drying_hours`, `cooling_fan`, `density_g_cm3`, `tensile_strength_mpa`, `heat_resistance_c`, `uv_resistant`, `food_safe`, `is_abrasive`, `moisture_sensitivity_days`, `beginner_tips`

Materials to seed: PLA, PLA+, PETG, ABS, ASA, TPU, TPU 95A, Nylon (PA), PC, SILK PLA, Matte PLA, PLA-CF, PETG-CF, PAHT-CF, PVA, BVOH, HIPS, PP

### Printer models reference (pre-seeded)
Popular models with full specs auto-filled when user adds them:
- Bambu: X1C, X1E, P1S, P1P, P2S, A1, A1 Mini, H2D
- Flashforge: AD5X, AD5M, Adventurer 5M Pro
- Prusa: MK4, MK3.9, Mini+, XL
- Creality: Ender 3 V3, K1, K1C, K2 Plus
- Voron: 2.4, Trident, 0.2

### AMS compatibility rules (pre-seeded)
- AMS Lite: compatible_printers = [A1, A1 Mini], max_units = 1, slots_per_unit = 4
- AMS / AMS 2 Pro: compatible_printers = [all Bambu], max_units = 4, slots_per_unit = 4
- AMS HT: compatible_printers = [all Bambu], max_units = 8, slots_per_unit = 1

### Purchase sources (pre-seeded)
Amazon (US/UK/DE/CA), Bambu Lab Store, Flashforge Store, Prusa Store, Polymaker, Hatchbox, eSUN, Overture, AliExpress, Temu, eBay, Microcenter, MakerBot, Creality Store

### Empty spool weights (pre-seeded)
Hatchbox: 246g, Prusament: 201g, eSUN: 230g, Bambu: 140g, Overture: 230g, Polymaker: 220g, Sunlu: 210g, Inland: 240g, Creality: 225g, Generic: 220g

### Assortment kit templates (pre-seeded)
Common M2/M3/M4 screw kits with known contents by SKU

---

## 13. Build Phases

### Phase 1 — Foundation ✅ COMPLETE

**Completed:**
- [x] Project scaffold: React 18 + Vite + TailwindCSS + Zustand + React Query (client)
- [x] Hono + Drizzle ORM + postgres (server)
- [x] Shared TypeScript types in /shared (User, Spool, FilamentProfile, etc.)
- [x] Full Drizzle schema — all tables in server/src/db/schema.ts
- [x] Magic link auth: create/verify with SHA-256 hashing (server/src/lib/auth.ts)
- [x] Auth routes: POST /api/auth/request-link, GET /api/auth/verify, POST /api/auth/logout, GET /api/auth/me
- [x] Login UI: card on dark page, success state, error strip
- [x] .env.example with all env vars documented
- [x] Tailwind config — full Midnight Blue token set (page, surface, elevated, input, accent/*, ink/*, border/*, semantic colors)
- [x] Google Fonts — Inter + JetBrains Mono wired into index.html
- [x] index.css — global component classes: btn-primary/secondary/ghost/danger/icon, input, label, card, badge-*, progress-track/fill-*, alert-strip-*
- [x] @tabler/icons-react installed, outline style throughout
- [x] AppShell — 52px icon sidebar, Midnight Blue #0a1020 bg, logo mark, nav icons, active state with border-left: 2px solid #6366f1
- [x] Server response helpers — ok() / err() used across all routes
- [x] Filament profile routes: GET/POST/PATCH/DELETE /api/filament/profiles (session-protected)
- [x] Spool routes: GET/POST/PATCH /api/filament/spools (with filament_remaining_g + filament_remaining_pct computed)
- [x] Weight logging: POST /api/filament/spools/:id/weigh + GET /api/filament/spools/:id/logs
- [x] Spool swap flow: POST /api/filament/spools/:id/swap (mark empty → promote oldest reserve → return both)
- [x] Dashboard — 2×4 stat grid (monospace values), quick-action buttons, live filament counts via React Query
- [x] Filament page — expandable profile cards with color swatches, remaining % progress bars, status badges
- [x] Log Weight modal, Spool Swap modal, Add Profile modal
- [x] Shared UI primitives — Badge, ProgressBar
- [x] Zero TypeScript errors, server and client both clean

**To go live:**
- [x] Paste Supabase DATABASE_URL into .env
- [x] cd server && npm run db:generate && npm run db:migrate
- [x] Push to GitHub → Vercel auto-deploys

**🚀 PHASE 1 SHIPPED — filamentos-xzpd.vercel.app — $(date +%Y-%m-%d)**
- All 23 database tables live in Supabase
- Magic link auth fully working (Resend → Supabase → session cookie)
- Protected dashboard + filament inventory routes live
- Midnight Blue design system live in production
- Vercel auto-deploys on every git push to main
- Survived: ESM/CJS boundary issues, pgBouncer quirks, Vercel handler signature fixes, stale password reset

### Phase 2 — Core inventory ✅ COMPLETE

- [x] Alert system — evaluateAlerts(userId), dedup guard, filament gram/spool/last-spool + parts stock + wear rules
- [x] Alert routes — GET /api/alerts, POST read/dismiss/evaluate
- [x] AlertBanner on dashboard — critical (red) / warning (yellow), bell count badge in sidebar
- [x] Reserve stock badges — 0 = danger, ≤ threshold = warning, 2+ = info, color-coded
- [x] Printer CRUD — 20 known models with auto-fill (Bambu X1C/P1S/A1/A1 Mini/H2D, Flashforge AD5X, Prusa MK4, Creality K1/Ender 3, Voron 2.4 etc.)
- [x] Accessories — AMS Lite compatibility validation, AMS HT requires AMS 2 Pro guard
- [x] Slot grid — color swatches per slot, spool picker with diameter filter
- [x] Spare parts — GET/POST/PATCH/DELETE per printer, install flow (decrements stock, creates installed_item), auto-seeds common parts on printer add
- [x] Workshop — full CRUD, import-kit wizard, category tabs, inline ±qty controls, low-stock highlights
- [x] Purchases — timeline with type filter, total spend, price history endpoint
- [x] Compatibility checker — checkCompatibility(printerId, profileId) → diameter, nozzle temp, enclosure, abrasive material, TPU/AMS rules. GET /api/printers/:id/compat/:profileId

### Phase 3 — Kits, projects, reference data, quote engine ✅ COMPLETE — 26 files, 0 TypeScript errors

- [x] Material reference database — material_reference table, 19 materials seeded with accurate values, GET /api/materials + GET /api/materials/:material
- [x] Material info panel in every expanded filament profile card — nozzle/bed ranges, drying req, enclosure badge, live moisture exposure warning from opened_date. Beginner view simplified, pro view shows density/tensile/heat resistance
- [x] Print kits — full CRUD, POST /kits/:id/build (deducts workshop stock), readiness check, kit cards with green/red indicator, component checklist, Start/Complete build buttons
- [x] Saved projects — CRUD routes + component management, platform badges (MakerWorld/Printables/Thingiverse), status selector, readiness score (e.g. "4/6 components ready")
- [x] Price history charts — Recharts LineChart per item, one colored line per source, tooltip, lowest/highest/avg/last summary row
- [x] Spend dashboard — new Spend tab: 3 KPI cards (all-time/this month/last month), stacked BarChart 6 months by category, PieChart by category, top 5 spend table
- [x] PWA config — vite-plugin-pwa, NetworkFirst for /api/*, CacheFirst for static, F logo SVG icon, theme #0f1623, Install app button in Settings
- [x] Mobile weight logging — thumb-friendly modal on Dashboard, 32px input, live filament remaining preview, Pre/Post/Just checking toggle, last 3 entries, 48px submit button
- [x] Smart quote engine — full CRUD + line items + inventory check + POST /complete
- [x] Quote cost calculator — filament, hardware, electricity, labor, nozzle wear, packaging, table fee all computed in quoteCalculator.ts
- [x] Pricing tiers — break-even / fair (2×) / market (3×) / suggested (clean round-up)
- [x] Beginner tips — labor $0 warning, table fee reminder, price below 2× cost alert, commercial license warning
- [x] Post-event logger — units sold + revenue → sell-through % + profit + contextual advice
- [x] Quote Settings — electricity rate, printer wattage, labor rate, default markup, default venue

**Next steps before Phase 4:**
- [ ] Run npm run db:migrate to add material_reference table
- [ ] Run seed: npx tsx --env-file=../.env server/src/db/seed/materials.ts
- [ ] Push to GitHub → Vercel auto-deploys
- [ ] Verify PWA installable on phone

### Phase 4 — Project URL parser ✅ COMPLETE — 8 tasks, TypeScript-clean, live

- [x] Affiliate URL builder — server/src/lib/affiliate.ts, Amazon/Bambu/AliExpress builders, tags from env (empty for now, links work regardless)
- [x] Page fetcher — server/src/lib/projectParser.ts, browser-header fetch, platform auto-detect (MakerWorld/Printables/Thingiverse/Cults3D), og:meta + title + HTML-strip + CC license detection
- [x] Component extractor — server/src/lib/componentExtractor.ts, claude-haiku-4-5, JSON-only parse, never throws, capped at 20
- [x] Parser route — POST /:id/parse + /:id/reparse, fuzzy inventory matching → have_it/low/missing, affiliate links stored, PATCH confirm endpoint
- [x] Rate limit — 10 parses/user/day via parse_usage table, friendly 429 "Daily parse limit reached — resets tomorrow", counts only successful fetches
- [x] Projects UI — Parse/Re-parse button with loading state, component rows (type badge · status badge · buy links), readiness progress bar, per-row + Confirm-all, prefilled Add-to-inventory modal, FTC affiliate disclosure
- [x] Quote integration — POST /quotes/from-project/:projectId pre-populates line items from matched inventory, "Create quote" button → auto-expands quote
- [x] License check — CC license parsed → stored in saved_projects.notes, badge on card (Commercial OK / Personal only / Unknown), red warning strip in quote UI when commercial_ok: false
- [x] @anthropic-ai/sdk installed, ANTHROPIC_API_KEY documented

**⚠️ SUPERSEDED by Phase 4.5** — URL parsing and the affiliate/quote system below were removed in the Projects/Quotes merge. Kept here for history.

### Phase 4.5 — Projects/Quotes merge + remove parsing ✅ COMPLETE

Major structural refactor based on real usage feedback:
- [x] Removed URL parsing entirely — deleted projectParser.ts, componentExtractor.ts, affiliate.ts, quoteCalculator.ts, quotes route; dropped parse_usage + project_components tables; removed @anthropic-ai/sdk dependency. (ANTHROPIC_API_KEY kept in .env.example but unused.) Reason: MakerWorld/Cloudflare blocked it — only 1 of 4 sites allowed parsing.
- [x] Merged Projects + Quotes into one unified `projects` table + page (dropped quote_projects, quote_line_items, saved_projects)
- [x] New nested structure: project_plates → project_plate_colors (filament + grams) → project_parts (workshop items)
- [x] Plate→color model: each plate has 1+ colors, each color maps to inventory filament + grams. Grows dynamically (add/remove plates, add/remove colors per plate)
- [x] Print time toggle: per_unit (multiplies linearly) OR per_plate (units_per_plate + full_plate_time + user-entered partial_plate_time from slicer when batch doesn't divide evenly)
- [x] Printer selector — only shown if user has 2+ printers; auto-assigns the single printer on create and shows "Printing on: [name]" as text
- [x] Always-on cost-to-print panel on every project (filament + parts + electricity + labor + packaging), per-unit AND batch, with inventory shortfall check
- [x] Collapsible selling section: batch qty, venue, event date, packaging, table fee, platform fee %, 4 pricing tiers, post-event tracking with sell-through advice + beginner tips
- [x] server/src/lib/projectCost.ts — pure cost engine reading plates/colors/parts; tiers + sell-through + shortfalls
- [x] Removed Quotes from sidebar nav + dashboard; /quotes redirects to /projects
- [x] "Cost & pricing settings" section in Settings (electricity rate, wattage, labor rate, markup, venue, packaging) — now applies to all projects
- [x] Migration 0003_unified_projects.sql applied directly via Supabase (drops + creates). Zero TypeScript errors; full build clean.

### Phase 5 — SaaS launch
- [ ] Remove allowlist → open signups
- [ ] Stripe integration (Free / Maker $5/mo / Farm $15/mo)
- [ ] Plan limits enforcement
- [ ] Landing page (en + es)
- [ ] Community price data opt-in
- [ ] Price drop alerts on community data
- [ ] Spanish localization (i18n)

### Phase 6 — Resin printer support (future)
- [ ] Resin printer type + resin bottle inventory
- [ ] FEP film + LCD screen wear tracking
- [ ] Safety warning system (ventilation, gloves)
- [ ] Resin material reference database
- [ ] Wash/cure consumables tracking

### Phase 7 — Laser cutter support (future)
- [ ] Laser machine type + sheet material inventory
- [ ] Laser tube hours tracking + wear alerts
- [ ] Cut settings reference per material
- [ ] Air assist + fume extractor consumables
- [ ] Laser machines reference database

---

## 14. Environment Variables

### Vercel + Supabase Deployment

#### Project structure for Vercel ✅ BUILT

```
filamentos/
├── api/
│   └── index.ts          ← Vercel serverless entry — imports Hono app, wraps with handle()
├── client/               ← React frontend (Vite build output → client/dist)
├── server/
│   └── src/
│       └── index.ts      ← Hono app — exports default app; serve() guarded behind !VERCEL env
├── shared/               ← Shared TypeScript types
├── vercel.json           ← Routing + build config
├── tsconfig.json         ← Root tsconfig scoped to api/ for Vercel's TS compilation
└── package.json          ← Root package.json with explicit cd build scripts
```

#### `api/index.ts` ✅

```ts
import { handle } from 'hono/vercel'
import app from '../server/src/index'

export const config = {
  runtime: 'nodejs20.x'   // Node runtime — required for Drizzle/postgres (needs Node APIs)
}

export default handle(app)
```

#### `vercel.json` ✅

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "client/dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/index.ts": {
      "maxDuration": 30
    }
  }
}
```

#### `server/src/index.ts` — key pattern ✅

```ts
// Always export the Hono app as default — Vercel imports this
export default app

// serve() only runs locally — NOT included in Vercel bundle
if (!process.env.VERCEL) {
  const { serve } = await import('@hono/node-server')
  serve({ fetch: app.fetch, port: 3001 })
}
```

#### Root `tsconfig.json` ✅

Covers `api/` so Vercel's TypeScript compilation resolves `hono/vercel` types
and follows the `../server/src/index` path. References `./server` for composite
project resolution.

#### Root `package.json` scripts ✅

Uses explicit `cd` commands — more predictable than npm workspace flags in Vercel's build runner:

```json
{
  "scripts": {
    "build": "cd client && npm run build && cd ../server && npm run build",
    "dev": "concurrently "npm run dev:server" "npm run dev:client"",
    "dev:client": "cd client && npm run dev",
    "dev:server": "cd server && npm run dev",
    "db:generate": "cd server && npm run db:generate",
    "db:migrate": "cd server && npm run db:migrate"
  },
  "devDependencies": {
    "concurrently": "already installed"
  }
}
```

Note: `hono/vercel` is built into Hono v4 — no extra install needed.

#### Vercel deploy steps ✅

1. Push repo to GitHub
2. Import project in Vercel — **Framework: Other** (not Vite preset — build command is custom)
3. Add all vars below under Project → Settings → Environment Variables
4. Set `APP_URL` = your Vercel deployment URL (e.g. `https://filamentos.vercel.app`) initially, then update to `https://filamentos.app` after adding custom domain
5. Deploy — Vercel runs `npm run build`, serves `client/dist`, routes `/api/*` through Node.js function

#### Vercel environment variables

Set these in the Vercel dashboard under Project → Settings → Environment Variables:

```env
# Database
DATABASE_URL=postgresql://...

# Auth / Email
RESEND_API_KEY=re_...
APP_URL=https://filamentos.app
SESSION_SECRET=...

# AI (for project URL parsing — Phase 4)
ANTHROPIC_API_KEY=sk-ant-...

# Affiliate tags
AMAZON_AFFILIATE_TAG=filamentos-20
BAMBU_AFFILIATE_ID=...
ALIEXPRESS_AFFILIATE_KEY=...

# Feature flags
INVITE_ONLY=true
ENABLE_PROJECT_PARSER=false
ENABLE_STRIPE=false
ENABLE_QUOTE_ENGINE=true
```

---


---

## 15. Design System

### Theme: Midnight Blue

Dark navy background, indigo/purple accent. Premium, calm, focused. Feels like a control room for your print shop.

### Core Color Tokens

```css
/* Base backgrounds */
--color-bg-page:        #0f1623;   /* Page background — deepest navy */
--color-bg-surface:     #151e30;   /* Cards, sidebars, panels */
--color-bg-elevated:    #1e2a3e;   /* Hover states, active rows, dropdowns */
--color-bg-input:       #1a2436;   /* Form inputs, text areas */

/* Accent — Indigo/Purple */
--color-accent:         #818cf8;   /* Primary accent — buttons, links, active states */
--color-accent-strong:  #6366f1;   /* Logo, primary CTA buttons, badge fills */
--color-accent-subtle:  #1e2a3e;   /* Accent backgrounds, selected rows */
--color-accent-muted:   #3d4a6e;   /* Accent borders, dividers */

/* Text */
--color-text-primary:   #cdd6f4;   /* Main text */
--color-text-secondary: #8896b8;   /* Labels, metadata, subtitles */
--color-text-tertiary:  #4a5a7a;   /* Placeholders, disabled, hints */
--color-text-accent:    #818cf8;   /* Accent text, links */

/* Borders */
--color-border:         #1e2a3e;   /* Default border */
--color-border-strong:  #2e3e58;   /* Emphasized borders, table lines */

/* Semantic — Status colors */
--color-success:        #4ade80;   /* OK / good / in stock */
--color-success-bg:     #172a20;   /* Success background */
--color-warning:        #fbbf24;   /* Low stock / approaching threshold */
--color-warning-bg:     #1e1a10;   /* Warning background */
--color-danger:         #f87171;   /* Critical / out of stock / error */
--color-danger-bg:      #2a1515;   /* Danger background */
--color-info:           #60a5fa;   /* Informational / neutral alerts */
--color-info-bg:        #1a2436;   /* Info background */

/* Filament swatch ring */
--color-swatch-ring:    #2e3e58;   /* Border around color swatches */
```

### Typography

```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Scale */
--text-xs:   11px;   /* Badges, metadata, uppercase labels */
--text-sm:   12px;   /* Secondary content, table cells */
--text-base: 13px;   /* Default UI text */
--text-md:   14px;   /* Section headings, card titles */
--text-lg:   16px;   /* Page headings */
--text-xl:   20px;   /* Stat values, large numbers */
--text-2xl:  24px;   /* Hero numbers on dashboard */

/* Weights */
--font-normal:  400;
--font-medium:  500;
--font-semibold: 600;
--font-bold:    700;   /* Stat values, logo, nav active */
```

### Spacing & Radius

```css
/* Spacing scale */
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;

/* Border radius */
--radius-sm:  6px;    /* Badges, tags, small pills */
--radius-md:  8px;    /* Inputs, buttons, small cards */
--radius-lg:  10px;   /* Cards, panels, modals */
--radius-xl:  14px;   /* Large cards, sheet drawers */
--radius-full: 9999px; /* Pills, avatars, swatch circles */
```

### Component Patterns

#### Sidebar
```
width: 52px (icon-only) / 200px (expanded, future)
background: #0a1020
border-right: 1px solid #1e2a3e
logo mark: 28×28px, radius 7px, background #6366f1, color #fff, font-weight 800
nav icons: 28×28px, radius 7px, color #6b7db3
nav icons (active): background #1e2a3e, color #818cf8
```

#### Top bar
```
height: 44px
background: #0f1623
border-bottom: 1px solid #1e2a3e
title: 14px, font-weight 600, color #cdd6f4
```

#### Cards / surfaces
```
background: #151e30
border: 1px solid #1e2a3e
border-radius: 10px
padding: 14px 16px
hover border: #2e3e58
```

#### Stat cards (dashboard metrics)
```
background: #151e30
border: 1px solid #1e2a3e
border-radius: 8px
padding: 10px 12px
value: 20px, font-weight 700, color #cdd6f4
label: 9px, font-weight 600, uppercase, letter-spacing .06em, opacity .5
```

#### Buttons
```
Primary:   background #6366f1, color #fff, radius 8px, padding 8px 16px, font-weight 600
Secondary: background #1e2a3e, color #818cf8, border 1px solid #3d4a6e
Ghost:     background transparent, color #8896b8, border 1px solid #1e2a3e
Danger:    background #2a1515, color #f87171, border 1px solid #3a2020
```

#### Inputs
```
background: #1a2436
border: 1px solid #1e2a3e
border-radius: 8px
padding: 8px 12px
color: #cdd6f4
placeholder: #4a5a7a
focus border: #6366f1
height: 36px
```

#### Badges / tags
```
Default:  background #1e2a3e, color #8896b8
Success:  background #172a20, color #4ade80
Warning:  background #1e1a10, color #fbbf24
Danger:   background #2a1515, color #f87171
Accent:   background #6366f1, color #fff
Info:     background #1a2436, color #60a5fa
font-size: 10px, font-weight 700, text-transform uppercase
padding: 2px 7px, border-radius: 20px
```

#### Progress bars (filament remaining)
```
track: background #1e2a3e, height 4px, radius 2px
fill:  background #818cf8 (>30%), #fbbf24 (10-30%), #f87171 (<10%)
```

#### Filament color swatches
```
size: 28px × 28px
border-radius: 50%
border: 2px solid #2e3e58
background: the filament's color_hex value
```

#### Alert strips
```
Critical: background #2a1515, color #f87171, border-top/bottom 1px solid #3a2020
Warning:  background #1e1a10, color #fbbf24, border-top/bottom 1px solid #2e2810
Info:     background #1a2436, color #60a5fa, border-top/bottom 1px solid #1e3050
padding: 8px 16px, font-size 11px, font-weight 500
```

#### Navigation active indicator
```
Active sidebar icon:
  background: #1e2a3e
  color: #818cf8
  border-left: 2px solid #6366f1  (left edge accent line)
```

### Tailwind Config

Add to `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      page:    '#0f1623',
      surface: '#151e30',
      elevated:'#1e2a3e',
      input:   '#1a2436',
      accent: {
        DEFAULT: '#818cf8',
        strong:  '#6366f1',
        subtle:  '#1e2a3e',
        muted:   '#3d4a6e',
      },
      ink: {
        primary:   '#cdd6f4',
        secondary: '#8896b8',
        tertiary:  '#4a5a7a',
      },
      border: {
        DEFAULT: '#1e2a3e',
        strong:  '#2e3e58',
      },
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
    borderRadius: {
      sm:   '6px',
      md:   '8px',
      lg:   '10px',
      xl:   '14px',
    },
  },
},
```

### Font Setup

Add to `client/index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Icons

Use **Tabler Icons** throughout — outline style only.
```
npm install @tabler/icons-react
```

Key icons used:
- Dashboard: `ti-home`
- Filament: `ti-cylinder`
- Printers: `ti-printer`
- Workshop: `ti-tool`
- Projects: `ti-file-3d`
- Quotes: `ti-receipt`
- Purchases: `ti-shopping-cart`
- Alerts: `ti-bell`
- Settings: `ti-settings`
- Weight log: `ti-weight`
- Spool swap: `ti-refresh`
- Low stock: `ti-alert-triangle`
- Good status: `ti-circle-check`

### PWA Theme Color

```json
// In vite-plugin-pwa config and manifest.json
"theme_color": "#0f1623",
"background_color": "#0f1623"
```

### Design Principles

1. **Dark and deep** — never use pure black (#000). The page is #0f1623, surfaces are #151e30. Depth comes from layering these.
2. **Accent sparingly** — indigo (#818cf8) is for interactive elements and active states only. Not decoration.
3. **Color swatches are the hero** — filament color dots are the most visually important element. Give them room and a clean ring border so they pop.
4. **Status through color + icon** — never rely on color alone. Every alert badge has an icon. Every status tag has text. Accessible by default.
5. **Monospace for numbers** — all weights, prices, quantities, and measurements use `font-mono`. Makes data scannable and prevents layout shift.
6. **Mobile-first layout** — sidebar collapses to bottom nav on mobile. Cards stack to full width. Weight logging flow is thumb-friendly.

---
## Notes for Claude Code

- Always check `PLANNING.md` at the start of each session
- Build Phase 1 completely before moving to Phase 2
- The database schema is the source of truth — don't deviate without updating this doc
- All monetary values stored as `numeric(10,2)` — never floats
- All weights stored as `numeric(6,1)` — one decimal place (grams)
- Gross weight is always stored — never calculated remaining weight
- Alert evaluation runs on every mutation + daily cron — keep it fast
- Affiliate URLs are built at query time, not stored as final URLs (tags may change)
- Feature flags in env vars control invite-only mode, parser, and Stripe
- The app should work perfectly on mobile — makers use it at the printer
- Always refer to Section 15 (Design System) for exact colors, typography, spacing, and component patterns — never guess or use generic Tailwind defaults
- Use Inter for all UI text, JetBrains Mono for all numbers/weights/prices
- The accent color (#818cf8 / #6366f1) is for interactive elements only — not decoration
- Filament color swatches are the visual hero of the app — give them space and a clean ring border (#2e3e58)
- All numeric values (weights, prices, counts) must use font-mono class
- Quote cost totals are ALWAYS recalculated from line items — never store computed totals
- Beginner tips in the quote engine are contextual — show them inline, not as a wall of text
- The commercial license warning on quotes is important — show it prominently when a MakerWorld project is linked

---

## Future: MakerOS Expansion

When resin and laser support ships (Phases 6–7), evaluate rebranding FilamentOS → MakerOS.
Register **makeros.app** now as a parked domain — cheap insurance.
The filamentos.app domain continues to work as a redirect or Spanish-language entry point.

---

*FilamentOS — On the build plate. Let's print.* 🎉