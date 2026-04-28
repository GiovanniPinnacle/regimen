// /backburner is now a "Parked" tab inside /stack — redirect.

import { redirect } from "next/navigation";

export default function BackburnerRedirect() {
  redirect("/stack");
}
