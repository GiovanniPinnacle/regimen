// /api/ingredient-stack — return cumulative ingredient totals + UL
// warnings for the signed-in user.
//
// Used by the StackWarningsBanner on /today and the audit page to flag
// stacked dosing problems (e.g. 6400 IU vit D from multi + D3 cap +
// cod liver oil exceeds the 4000 IU NIH UL).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeIngredientStack } from "@/lib/ingredient-stack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const result = await computeIngredientStack(user.id);
  return NextResponse.json(result);
}
