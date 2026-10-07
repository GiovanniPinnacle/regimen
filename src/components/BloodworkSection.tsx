"use client";

// BloodworkSection — upload affordance for /tests. The biomarker list is
// server-rendered by the page, so a successful save just refreshes the
// route to pull the new draw.

import { useRouter } from "next/navigation";
import BloodworkUpload from "@/components/BloodworkUpload";

export default function BloodworkSection() {
  const router = useRouter();
  return (
    <div className="mb-2">
      <BloodworkUpload onSaved={() => router.refresh()} />
    </div>
  );
}
