"use client";

// BloodworkSection — client island that bundles the upload affordance
// + recent-biomarkers list. Saves on the upload trigger a refreshKey
// bump so the recent list re-fetches automatically.

import { useState } from "react";
import BloodworkUpload from "@/components/BloodworkUpload";
import RecentBiomarkers from "@/components/RecentBiomarkers";

export default function BloodworkSection() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="mb-6">
      <BloodworkUpload onSaved={() => setRefreshKey((k) => k + 1)} />
      <RecentBiomarkers refreshKey={refreshKey} />
    </div>
  );
}
