// Core domain types for Regimen

export type TimingSlot =
  | "pre_breakfast"
  | "breakfast"
  | "pre_workout"
  | "lunch"
  | "dinner"
  | "pre_bed"
  | "situational"
  | "ongoing";

export type Category =
  | "permanent"
  | "temporary"
  | "cycled"
  | "situational"
  | "condition_linked";

export type Frequency =
  | "daily"
  | "weekly"
  | "cycle_8_2"
  | "situational"
  | "as_needed"
  | "ongoing";

export type Goal =
  | "hair"
  | "sleep"
  | "gut"
  | "foundational"
  | "metabolic"
  | "cortisol"
  | "inflammation"
  | "circulation"
  | "testosterone"
  | "skin_joints"
  | "AGA"
  | "seb_derm"
  | "longevity"
  | "recovery";

export type Status = "active" | "queued" | "backburner" | "retired";

export type PurchaseState =
  | "needed"
  | "ordered"
  | "shipped"
  | "arrived"
  | "using"
  | "depleted";

export type ItemType =
  | "supplement"
  | "topical"
  | "device"
  | "procedure"
  | "practice"
  | "food"
  | "gear"
  | "test";

export type ScheduleRule = {
  frequency: Frequency;
  time?: string;
  cycle_on_days?: number;
  cycle_off_days?: number;
  days_per_week?: number;
  notes?: string;
};

export type Item = {
  id: string;
  user_id?: string;
  seed_id?: string; // if seeded, matches a known seed constant
  name: string;
  brand?: string;
  dose?: string;
  unit?: string;
  timing_slot: TimingSlot;
  schedule_rule: ScheduleRule;
  category: Category;
  item_type: ItemType;
  goals: Goal[];
  started_on?: string;
  ends_on?: string;
  review_trigger?: string;
  status: Status;
  owned?: boolean | null; // null = not yet audited, true = have, false = need to order
  notes?: string;
  purchase_url?: string;
  companion_of?: string | null; // item.id of parent — this item nests under parent on Today
  companion_instruction?: string | null; // e.g. "stir into coffee"
  purchase_state?: PurchaseState | null;
  ordered_on?: string | null;
  arrived_on?: string | null;
  days_supply?: number | null;
  unit_cost?: number | null;
  reorder_alert_sent_at?: string | null;
  usage_notes?: string | null;
  research_summary?: string | null;
  research_generated_at?: string | null;
  deep_research?: string | null;
  deep_research_generated_at?: string | null;
  sort_order?: number | null;
  // Affiliate primitive — see migration 014. Recommendations are picked
  // first; affiliates are metadata on already-recommended items.
  vendor?: string | null;
  affiliate_url?: string | null;
  list_price_cents?: number | null;
  vendor_sku?: string | null;
  // Global catalog link — see migration 023. When set, this item shares
  // macro/micro/mechanism data with all users who picked the same
  // catalog entry. The catalog row is enriched lazily by Coach.
  catalog_item_id?: string | null;
  // Protocol provenance — see migration 015.
  from_protocol_slug?: string | null;
  from_protocol_item_key?: string | null;
  created_at?: string;
  // Transient/rendering-only — populated client-side
  __companions?: Item[];
};

// ---------- Protocols (prebuilt regimens shipped in /lib/protocols) ----------

export type ProtocolCategory =
  | "recovery"
  | "fitness"
  | "posture"
  | "sleep"
  | "hair"
  | "skin"
  | "metabolic"
  | "mind"
  | "longevity";

export type ProtocolItem = {
  /** Stable key — used to track this item in the user's items table. */
  key: string;
  name: string;
  brand?: string;
  dose?: string;
  item_type: ItemType;
  timing_slot: TimingSlot;
  category: Category;
  goals: Goal[];
  /** Day relative to enrollment start. 0 = day of enrollment. */
  starts_on_day?: number;
  /** Day after which item expires. null = stays for full protocol duration. */
  ends_on_day?: number | null;
  /** Simple frequency for protocol authoring; becomes a ScheduleRule on enroll. */
  schedule_rule?: Frequency;
  usage_notes?: string;
  research_summary?: string;
  citations?: string[];
  vendor?: string;
  affiliate_url?: string;
  list_price_cents?: number;
  /** Photo/video URL for how-to (form, application, etc.) */
  media_url?: string;
  sort_order?: number;
  /** Key of the parent item this companions to (within same protocol). */
  companion_of?: string;
  companion_instruction?: string;
  /** Free-form review trigger (e.g., "Day 30 — assess shock loss"). */
  review_trigger?: string;
};

export type ProtocolPhase = {
  /** e.g. "Days 0-3 — Critical post-op" */
  label: string;
  starts_on_day: number;
  ends_on_day: number;
  summary: string;
  what_to_expect?: string[];
  red_flags?: string[];
};

export type ProtocolTimelineMilestone = {
  /** "Week 3", "Day 30", "Month 2" */
  marker: string;
  starts_on_day: number;
  expect: string;
  evidence?: string;
};

export type Protocol = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: ProtocolCategory;
  duration_days: number;
  /** SVG/emoji string or image URL for the cover. Keep simple. */
  cover_emoji?: string;
  cover_image_url?: string;
  hero_video_url?: string;
  author: {
    name: string;
    credentials?: string;
    bio?: string;
  };
  /** 0 = free. Paid protocols can be unlocked via credit or Pro tier. */
  pricing_cents: number;
  is_official: boolean;
  research_summary: string;
  expected_timeline: ProtocolTimelineMilestone[];
  phases?: ProtocolPhase[];
  safety_notes: string;
  contraindications?: string[];
  items: ProtocolItem[];
  /** Tags for browse/filter. */
  tags?: string[];
};

export type ProtocolEnrollment = {
  id: string;
  user_id: string;
  protocol_slug: string;
  enrolled_at: string;
  start_date: string;
  status: "active" | "completed" | "paused" | "cancelled";
};

// ---------- Item reactions (RP-style stim/fatigue tags) ----------

export type ReactionType = "helped" | "no_change" | "worse" | "forgot";

export type ItemReaction = {
  id: string;
  user_id: string;
  item_id: string;
  reaction: ReactionType;
  reacted_on: string;
  notes?: string | null;
  created_at: string;
};

export const REACTION_LABELS: Record<ReactionType, string> = {
  helped: "Helped",
  no_change: "No change",
  worse: "Worse",
  forgot: "Forgot",
};

export const REACTION_EMOJI: Record<ReactionType, string> = {
  helped: "👍",
  no_change: "✋",
  worse: "👎",
  forgot: "❓",
};

export type RecipeIngredient = {
  name: string;
  amount?: string;
  notes?: string;
};

export type WishlistPriority = "low" | "medium" | "high";

export type WishlistItem = {
  id: string;
  user_id?: string;
  name: string;
  url?: string | null;
  est_cost?: number | null;
  category?: string | null;
  notes?: string | null;
  priority: WishlistPriority;
  promoted_to_item_id?: string | null;
  promoted_at?: string | null;
  created_at?: string;
};

export type Recipe = {
  id: string;
  user_id?: string;
  name: string;
  description?: string | null;
  source: "user" | "claude";
  servings: number;
  calories_per_serving?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carbs_g?: number | null;
  ingredients: RecipeIngredient[];
  instructions?: string | null;
  tags: string[];
  goals: Goal[];
  is_favorite: boolean;
  times_made: number;
  last_made?: string | null;
  fridge_snapshot?: string | null;
  created_at?: string;
};

export type StackLogEntry = {
  id: string;
  date: string;
  item_id: string;
  taken: boolean;
  skipped_reason?: string;
  logged_at: string;
};

export type SymptomLog = {
  date: string;
  feel_score?: number;
  sleep_quality?: number;
  seb_derm_score?: number;
  stress?: number;
  energy_pm?: number;
  notes?: string;
};

export type HardNo = {
  category: "pharmaceutical" | "food" | "supplement" | "product" | "test" | "approach";
  name: string;
  reason?: string;
};

export type ChangelogEntry = {
  id: string;
  date: string;
  change_type: "add" | "remove" | "adjust" | "promote" | "demote";
  item_id?: string;
  item_name?: string;
  reasoning: string;
  triggered_by?: string;
  approved_by_user: boolean;
};
