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
  reorder_alert_sent_at?: string | null;
  created_at?: string;
  // Transient/rendering-only — populated client-side
  __companions?: Item[];
};

export type RecipeIngredient = {
  name: string;
  amount?: string;
  notes?: string;
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
