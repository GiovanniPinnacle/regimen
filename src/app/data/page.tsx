export default function DataPage() {
  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Data imports
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          Upload Oura CSV, bloodwork PDFs, and photos
        </div>
      </header>

      <div
        className="border-hair rounded-xl p-8 text-center"
        style={{ color: "var(--muted)" }}
      >
        <div className="text-[14px] mb-2" style={{ fontWeight: 500 }}>
          Coming in Weekend 2
        </div>
        <div className="text-[13px]">
          Claude vision pipeline for food photos, supplement photos, scalp
          tracking. PDF extraction for bloodwork. CSV parsing for Oura + Stelo.
        </div>
      </div>
    </div>
  );
}
