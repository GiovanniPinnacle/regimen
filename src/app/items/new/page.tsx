import ItemForm from "@/components/ItemForm";
import PageHeader from "@/components/ui/PageHeader";

const BACK_LABEL: Record<string, string> = {
  "/stack": "Stack",
  "/today": "Today",
  "/you": "You",
  "/fuel": "Fuel",
  "/train": "Train",
  "/purchases": "Shopping",
};

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  // Back goes where the user came from (same ?from= rule ItemForm uses
  // after saving), else the stack.
  const { from } = await searchParams;
  const back =
    from && from.startsWith("/") && !from.startsWith("//") ? from : "/stack";
  const backLabel = BACK_LABEL[back.split("?")[0]] ?? "Back";

  return (
    <div className="pb-24">
      <PageHeader
        title="Add to your stack"
        back={back}
        backLabel={backLabel}
        subtitle="Supplements, topicals, devices, practices, foods, gear — anything in your routine."
      />
      <ItemForm />
    </div>
  );
}
