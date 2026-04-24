// Portion / macro calculator.
// Uses Mifflin-St Jeor equation for BMR, then activity + goal adjustments.

export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "very_active"
  | "extra";
export type BodyGoal = "lean" | "maintain" | "build";

export type ProfileInput = {
  weight_kg: number;
  height_cm: number;
  age: number;
  biological_sex: Sex;
  activity_level: ActivityLevel;
  body_goal: BodyGoal;
  meals_per_day: number;
  post_op?: boolean; // adds extra protein for wound healing
};

export type MacroTargets = {
  bmr: number; // resting metabolic rate kcal
  tdee: number; // total daily energy expenditure kcal
  calories: number; // goal-adjusted calories
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  per_meal: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  };
};

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2, // desk job, no exercise
  light: 1.375, // 1-3 days/wk light exercise
  moderate: 1.55, // 3-5 days/wk moderate
  very_active: 1.725, // 6-7 days/wk
  extra: 1.9, // 2x/day or physical job
};

const GOAL_DELTA: Record<BodyGoal, number> = {
  lean: -0.15, // 15% deficit
  maintain: 0,
  build: 0.1, // 10% surplus
};

export function calcMacros(p: ProfileInput): MacroTargets {
  // Mifflin-St Jeor BMR
  const base =
    10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age;
  const bmr = p.biological_sex === "male" ? base + 5 : base - 161;

  const tdee = bmr * ACTIVITY_MULTIPLIER[p.activity_level];
  const calories = Math.round(tdee * (1 + GOAL_DELTA[p.body_goal]));

  // Protein target: 1.6-2.2 g/kg depending on goal + post-op modifier
  let proteinPerKg = 1.8; // maintenance baseline
  if (p.body_goal === "lean") proteinPerKg = 2.2; // preserve muscle in deficit
  if (p.body_goal === "build") proteinPerKg = 2.0;
  if (p.post_op) proteinPerKg += 0.3; // extra for wound healing

  const protein_g = Math.round(p.weight_kg * proteinPerKg);

  // Fat: ~30% of calories for hormonal support (T, skin)
  const fatPct = p.body_goal === "lean" ? 0.3 : 0.32;
  const fat_g = Math.round((calories * fatPct) / 9);

  // Carbs: remainder
  const proteinKcal = protein_g * 4;
  const fatKcal = fat_g * 9;
  const carbs_g = Math.max(
    0,
    Math.round((calories - proteinKcal - fatKcal) / 4),
  );

  const m = Math.max(1, p.meals_per_day);
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories,
    protein_g,
    fat_g,
    carbs_g,
    per_meal: {
      calories: Math.round(calories / m),
      protein_g: Math.round(protein_g / m),
      fat_g: Math.round(fat_g / m),
      carbs_g: Math.round(carbs_g / m),
    },
  };
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary",
  light: "Light (1-3×/wk)",
  moderate: "Moderate (3-5×/wk)",
  very_active: "Very active (6-7×/wk)",
  extra: "Extra (2×/day or physical job)",
};

export const GOAL_LABELS_BODY: Record<BodyGoal, string> = {
  lean: "Lean down",
  maintain: "Maintain",
  build: "Build muscle",
};
