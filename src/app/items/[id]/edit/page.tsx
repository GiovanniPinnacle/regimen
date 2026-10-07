import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ItemForm from "@/components/ItemForm";
import PageHeader from "@/components/ui/PageHeader";
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
      <PageHeader
        title="Edit item"
        back={`/items/${id}`}
        backLabel={
          item.name.length > 28 ? `${item.name.slice(0, 27).trimEnd()}…` : item.name
        }
      />

      <ItemForm initial={item} />
    </div>
  );
}
