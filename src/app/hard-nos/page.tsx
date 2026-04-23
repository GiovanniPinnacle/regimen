import { HARD_NOS } from "@/lib/seed";

const CATEGORY_ORDER: Array<{
  key: "pharmaceutical" | "food" | "supplement" | "product" | "test" | "approach";
  label: string;
}> = [
  { key: "pharmaceutical", label: "Pharmaceuticals" },
  { key: "food", label: "Foods" },
  { key: "supplement", label: "Supplements" },
  { key: "product", label: "Specific products" },
  { key: "test", label: "Tests" },
  { key: "approach", label: "Approaches" },
];

export default function HardNosPage() {
  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Hard NOs
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          Enforced in Claude photo audits + recommendations
        </div>
      </header>

      {CATEGORY_ORDER.map((cat) => {
        const items = HARD_NOS.filter((h) => h.category === cat.key);
        if (items.length === 0) return null;
        return (
          <section key={cat.key} className="mb-8">
            <h2
              className="text-[11px] uppercase tracking-wider mb-3"
              style={{ color: "var(--muted)", fontWeight: 500 }}
            >
              {cat.label}
            </h2>
            <div className="flex flex-col gap-2">
              {items.map((h) => (
                <div
                  key={h.name}
                  className="border-hair rounded-xl p-3"
                >
                  <div className="text-[14px]" style={{ fontWeight: 500 }}>
                    {h.name}
                  </div>
                  {h.reason && (
                    <div
                      className="text-[12px] mt-0.5"
                      style={{ color: "var(--muted)" }}
                    >
                      {h.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
