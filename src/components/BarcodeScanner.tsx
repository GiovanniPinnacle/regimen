"use client";

// BarcodeScanner — full-screen camera sheet that decodes UPC/EAN
// barcodes via the browser-native BarcodeDetector API. On a hit, calls
// /api/catalog/lookup-upc which finds the product in our catalog or
// fetches it from Open Food Facts (3M+ products).
//
// BarcodeDetector is supported in Chrome / Edge / Safari (recent).
// On unsupported browsers, we render a manual UPC input fallback so
// the flow always works.

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";

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
  const [supported, setSupported] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualUpc, setManualUpc] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setResult(null);

    const hasDetector =
      typeof window !== "undefined" && Boolean(window.BarcodeDetector);
    setSupported(hasDetector);
    if (!hasDetector) return;

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
      alive = false;
      setScanning(false);
      if (detectInterval) clearInterval(detectInterval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open]);

  async function lookup(upc: string) {
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
  }

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
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "rgba(0,0,0,0.92)" }}
    >
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{ color: "#FBFAF6" }}
      >
        <div className="flex items-center gap-2">
          <Icon name="search" size={16} strokeWidth={1.8} />
          <div className="text-[14px]" style={{ fontWeight: 600 }}>
            Scan a barcode
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[13px] px-3 py-1.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.16)", color: "#FBFAF6" }}
        >
          Close
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        {result ? (
          <ResultCard result={result} onConfirm={confirm} />
        ) : supported === null ? (
          <div className="text-[14px]" style={{ color: "#FBFAF6" }}>
            Starting camera…
          </div>
        ) : supported ? (
          <div className="w-full max-w-md flex flex-col gap-3">
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                aspectRatio: "4 / 3",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Aim guide */}
              <div
                className="absolute"
                style={{
                  left: "10%",
                  right: "10%",
                  top: "40%",
                  bottom: "40%",
                  border: "2px solid rgba(34, 197, 94, 0.85)",
                  borderRadius: 8,
                  boxShadow: "0 0 0 200vmax rgba(0,0,0,0.45) inset",
                }}
                aria-hidden
              />
            </div>
            <div
              className="text-[12.5px] text-center"
              style={{ color: "rgba(251, 250, 246, 0.85)" }}
            >
              {scanning
                ? "Aim the green box at the barcode"
                : "Looking…"}
            </div>
            {err && (
              <div
                className="text-[12.5px] text-center px-3 py-2 rounded-lg"
                style={{
                  background: "rgba(239, 68, 68, 0.18)",
                  color: "#FBFAF6",
                }}
              >
                {err}
              </div>
            )}
          </div>
        ) : (
          <div
            className="w-full max-w-md flex flex-col gap-3"
            style={{ color: "#FBFAF6" }}
          >
            <div className="text-[14px] text-center">
              Your browser doesn&apos;t support barcode scanning. Type the
              UPC instead:
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={manualUpc}
                onChange={(e) => setManualUpc(e.target.value)}
                placeholder="UPC / EAN"
                className="flex-1 rounded-xl px-3 py-2.5 text-[15px]"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  color: "#FBFAF6",
                  border: "1px solid rgba(255,255,255,0.20)",
                }}
              />
              <button
                onClick={handleManual}
                disabled={!manualUpc.trim() || manualBusy}
                className="px-4 rounded-xl text-[14px]"
                style={{
                  background: "var(--accent)",
                  color: "#FBFAF6",
                  fontWeight: 700,
                  opacity: !manualUpc.trim() || manualBusy ? 0.5 : 1,
                }}
              >
                {manualBusy ? "…" : "Look up"}
              </button>
            </div>
            {err && (
              <div
                className="text-[12.5px] text-center px-3 py-2 rounded-lg"
                style={{
                  background: "rgba(239, 68, 68, 0.18)",
                  color: "#FBFAF6",
                }}
              >
                {err}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
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
  return (
    <div
      className="rounded-2xl max-w-md w-full p-5"
      style={{
        background: "var(--surface)",
        color: "var(--foreground)",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-wider mb-1.5"
        style={{
          color: "var(--accent)",
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        Match found · {result.source === "local" ? "from catalog" : "Open Food Facts"}
      </div>
      <div className="text-[18px] leading-snug" style={{ fontWeight: 700 }}>
        {item.name}
      </div>
      {item.brand && (
        <div className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
          {item.brand}
        </div>
      )}
      {(item.calories != null || item.protein_g != null) && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {item.calories != null && (
            <Stat label="kcal" value={String(Math.round(item.calories))} />
          )}
          {item.protein_g != null && (
            <Stat label="P" value={`${Math.round(item.protein_g)}g`} />
          )}
          {item.fat_g != null && (
            <Stat label="F" value={`${Math.round(item.fat_g)}g`} />
          )}
          {item.carbs_g != null && (
            <Stat label="C" value={`${Math.round(item.carbs_g)}g`} />
          )}
        </div>
      )}
      {item.coach_summary && (
        <div
          className="text-[12.5px] mt-3 leading-relaxed"
          style={{ color: "var(--foreground-soft)" }}
        >
          {item.coach_summary}
        </div>
      )}
      <button
        onClick={onConfirm}
        className="w-full mt-4 py-3 rounded-xl text-[14px] flex items-center justify-center gap-1.5"
        style={{
          background: "var(--accent)",
          color: "#FBFAF6",
          fontWeight: 700,
        }}
      >
        <Icon name="plus" size={13} strokeWidth={2.4} />
        Use this item
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl p-2 text-center"
      style={{ background: "var(--surface-alt)" }}
    >
      <div
        className="text-[14px] tabular-nums leading-none"
        style={{ fontWeight: 700 }}
      >
        {value}
      </div>
      <div
        className="text-[9.5px] mt-1 uppercase tracking-wider"
        style={{
          color: "var(--muted)",
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
    </div>
  );
}
