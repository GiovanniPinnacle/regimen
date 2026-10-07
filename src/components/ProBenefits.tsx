// ProBenefits — placeholder for the future Pro membership card.
//
// Pro isn't for sale yet, so this renders nothing. The previous version
// showed upsell + "value saved" / rebate claims we can't stand behind
// before launch; it was removed rather than hidden. When Pro ships,
// rebuild this against a real /api/pro/stats endpoint and flip SHOW_PRO.

const SHOW_PRO = false;

export default function ProBenefits() {
  if (!SHOW_PRO) return null;
  return null;
}
