import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ItemForm from "@/components/ItemForm";
import type { Item } from "@/lib/types";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const item = data as Item;

  return (
    <div className="pb-24">
      <div className="mb-4">
        <Link
          href={`/items/${id}`}
          className="text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          ← {item.name}
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-[32px] leading-tight" style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>
          Edit item
        </h1>
      </header>

      <ItemForm initial={item} />
    </div>
  );
}
