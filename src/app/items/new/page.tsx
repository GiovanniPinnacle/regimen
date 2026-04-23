import ItemForm from "@/components/ItemForm";
import Link from "next/link";

export default function NewItemPage() {
  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
            Add item
          </h1>
          <div
            className="text-[13px] mt-1"
            style={{ color: "var(--muted)" }}
          >
            Supplement, topical, device, practice, food, gear — anything in your regimen
          </div>
        </div>
        <Link
          href="/stack"
          className="text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          Cancel
        </Link>
      </header>
      <ItemForm />
    </div>
  );
}
