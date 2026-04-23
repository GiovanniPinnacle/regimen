// Core domain types for Regimen

export type TimingSlot =
  | "pre_breakfast"
  | "breakfast"
  | "pre_workout"
  | "lunch"
  | "dinner"
  | "pre_bed"
  | "situational";

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
  | "as_needed";

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
  | "longevity";

export type Status = "active" | "queued" | "backburner" | "retired";

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
  name: string;
  brand?: string;
  dose: string;
  unit?: string;
  timing_slot: TimingSlot;
  schedule_rule: ScheduleRule;
  category: Category;
  goals: Goal[];
  started_on?: string; // ISO date
  ends_on?: string;
  review_trigger?: string;
  status: Status;
  notes?: string;
  purchase_url?: string;
  created_at?: string;
};

export type StackLogEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  item_id: string;
  taken: boolean;
  skipped_reason?: string;
  logged_at: string; // ISO timestamp
};

export type SymptomLog = {
  date: string; // YYYY-MM-DD (unique)
  feel_score?: number; // 1-10
  sleep_quality?: number; // 1-10
  seb_derm_score?: number; // 0-10 (0=clear, 10=flare)
  stress?: number; // 1-10
  energy_pm?: number; // 1-10
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
