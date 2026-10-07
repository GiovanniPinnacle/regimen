"use client";

// BarcodeScanner — full-screen camera viewfinder that decodes UPC/EAN
// barcodes via the browser-native BarcodeDetector API. On a hit, calls
// /api/catalog/lookup-upc which finds the product in our catalog or
// fetches it from Open Food Facts (3M+ products).
//
// BarcodeDetector is supported in Chrome / Edge / Safari (recent).
// On unsupported browsers, we render a manual UPC input fallback so
// the flow always works.

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import Button, { IconButton } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";

// Browser typings for BarcodeDetector — not in TS lib by default
type DetectedBarcode = {
  rawValue: string;
  format: string;
};
type BarcodeDetectorClass = {
  new (opts?: { formats?: string[] }): {
    detect(source: HTMLVideoElement | ImageBitmap): Promise<DetectedBarcode[]>;
  };
};
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorClass;
  }
}

type ScanResult = {
  upc: string;
  item: {
    id?: string;
    name: string;
    brand: string | null;
    item_type: string;
    category: string | null;
    serving_size: string | null;
    calories: number | null;
    protein_g: number | null;
    fat_g: number | null;
    carbs_g: number | null;
    coach_summary: string | null;
    evidence_grade: string | null;
  };
  source: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onMatch: (result: ScanResult) => void;
};

export default function BarcodeScanner({ open, onClose, onMatch }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [supported] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    return Boolean(window.BarcodeDetector);
  });
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualUpc, setManualUpc] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

  const lookup = useCallback(async (upc: string) => {
    setScanning(false);
    try {
      const res = await fetch("/api/catalog/lookup-upc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upc }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        item: ScanResult["item"] | null;
        source: string | null;
      };
      if (data.ok && data.item) {
        setResult({ upc, item: data.item, source: data.source ?? "unknown" });
      } else {
        setErr(
          `No match for barcode ${upc}. Try a different angle, or add it manually.`,
        );
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const resetId = setTimeout(() => {
      setErr(null);
      setResult(null);
    }, 0);

    const hasDetector =
      typeof window !== "undefined" && Boolean(window.BarcodeDetector);
    if (!hasDetector) {
      return () => clearTimeout(resetId);
    }

    let alive = true;
    let detectInterval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const Detector = window.BarcodeDetector!;
        const detector = new Detector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
        });
        setScanning(true);
        detectInterval = setInterval(async () => {
          if (!videoRef.current || !alive) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && alive) {
              const code = codes[0].rawValue;
              if (detectInterval) clearInterval(detectInterval);
              await lookup(code);
            }
          } catch {
            /* keep trying */
          }
        }, 500);
      } catch (e) {
        if (alive) setErr((e as Error).message);
      }
    })();

    return () => {
      clearTimeout(resetId);
      alive = false;
      setScanning(false);
      if (detectInterval) clearInterval(detectInterval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open, lookup]);

  async function handleManual() {
    if (!manualUpc.trim()) return;
    setManualBusy(true);
    setErr(null);
    try {
      await lookup(manualUpc.trim());
    } finally {
      setManualBusy(false);
    }
  }

  function confirm() {
    if (!result) return;
    onMatch(result);
    setResult(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan a barcode"
      className="fixed inset-0 flex flex-col bg-[var(--background)] text-[var(--foreground)]"
      style={{
        zIndex: "var(--z-modal)" as unknown as number,
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <header className="flex min-h-[56px] items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2">
          <Icon name="barcode" size={20} strokeWidth={1.8} />
          <h2 className="text-title-3">Scan a barcode</h2>
        </div>
        <IconButton icon="x" label="Close scanner" onClick={onClose} />
      </header>

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 pb-6">
        {result ? (
          <ResultCard result={result} onConfirm={confirm} />
        ) : supported === null ? (
          <div role="status" className="text-callout text-[var(--muted)]">
            Starting camera…
          </div>
        ) : supported ? (
          <div className="flex w-full max-w-md flex-col gap-4">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)]">
              <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-cover"
              />
              <Reticle active={scanning} />
            </div>
            <p
              role="status"
              className="flex items-center justify-center gap-1.5 text-center text-footnote text-[var(--foreground-soft)]"
            >
              <Icon name="scan" size={14} strokeWidth={2} />
              {scanning ? "Line the barcode up inside the frame" : "Looking…"}
            </p>
            {err && <ErrorNote>{err}</ErrorNote>}
          </div>
        ) : (
          <div className="flex w-full max-w-md flex-col gap-3">
            <p className="text-center text-callout text-[var(--foreground-soft)]">
              This browser can&apos;t scan barcodes. Type the number under the
              barcode instead.
            </p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleManual();
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={manualUpc}
                onChange={(e) => setManualUpc(e.target.value)}
                placeholder="Barcode number"
                aria-label="Barcode number"
                className="input-field min-w-0 flex-1 tabular-nums"
              />
              <Button
                type="submit"
                size="lg"
                disabled={!manualUpc.trim()}
                loading={manualBusy}
              >
                Look up
              </Button>
            </form>
            {err && <ErrorNote>{err}</ErrorNote>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Viewfinder overlay: dimmed surround, a clear window with corner
 *  brackets, and a soft scan line while the detector is running. */
function Reticle({ active }: { active: boolean }) {
  const corner = "absolute h-6 w-6 border-[var(--foreground)]";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-[10%] top-[30%] bottom-[30%] rounded-[14px] shadow-[0_0_0_200vmax_rgba(0,0,0,0.5)]">
        <span className={`${corner} top-0 left-0 rounded-tl-[14px] border-t-[3px] border-l-[3px]`} />
        <span className={`${corner} top-0 right-0 rounded-tr-[14px] border-t-[3px] border-r-[3px]`} />
        <span className={`${corner} bottom-0 left-0 rounded-bl-[14px] border-b-[3px] border-l-[3px]`} />
        <span className={`${corner} right-0 bottom-0 rounded-br-[14px] border-r-[3px] border-b-[3px]`} />
        {active && (
          <span className="absolute inset-x-4 top-1/2 h-px bg-[var(--foreground)] opacity-70 motion-safe:animate-pulse" />
        )}
      </div>
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <Card
      tone="danger"
      padding="sm"
      role="alert"
      className="flex items-start gap-2 text-footnote text-[var(--foreground)]"
    >
      <Icon
        name="alert"
        size={16}
        strokeWidth={2}
        className="mt-px shrink-0 text-[var(--error)]"
      />
      <span>{children}</span>
    </Card>
  );
}

function ResultCard({
  result,
  onConfirm,
}: {
  result: ScanResult;
  onConfirm: () => void;
}) {
  const { item } = result;
  const macros: { label: string; value: string }[] = [];
  if (item.calories != null)
    macros.push({ label: "kcal", value: String(Math.round(item.calories)) });
  if (item.protein_g != null)
    macros.push({ label: "Protein", value: `${Math.round(item.protein_g)}g` });
  if (item.fat_g != null)
    macros.push({ label: "Fat", value: `${Math.round(item.fat_g)}g` });
  if (item.carbs_g != null)
    macros.push({ label: "Carbs", value: `${Math.round(item.carbs_g)}g` });
  return (
    <Card variant="raised" padding="lg" className="w-full max-w-md">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip tone="success" icon="check">
          Match found
        </Chip>
        <span className="text-caption text-[var(--muted)]">
          {result.source === "local" ? "From our catalog" : "From Open Food Facts"}
        </span>
      </div>
      <h3 className="text-title-2 leading-snug">{item.name}</h3>
      {item.brand && (
        <div className="mt-0.5 text-footnote text-[var(--muted)]">
          {item.brand}
        </div>
      )}
      {(item.calories != null || item.protein_g != null) && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {macros.map((m) => (
            <div
              key={m.label}
              className="rounded-[14px] bg-[var(--surface)] px-1 py-2.5 text-center"
            >
              <div className="text-title-3 leading-none tabular-nums">
                {m.value}
              </div>
              <div className="mt-1 text-caption text-[var(--muted)]">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      )}
      {item.coach_summary && (
        <p className="mt-3 text-callout leading-relaxed text-[var(--foreground-soft)]">
          {item.coach_summary}
        </p>
      )}
      <Button
        icon="plus"
        size="lg"
        fullWidth
        onClick={onConfirm}
        className="mt-5"
      >
        Use this item
      </Button>
    </Card>
  );
}
