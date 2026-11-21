/** Display formatters shared by server and client components. */

export function formatPrice(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value === 0) return "Free";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3).replace(/0$/, "")}`;
  return `$${value.toFixed(2).replace(/\.00$/, "")}`;
}

export function formatTokens(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatMonth(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function formatUsd(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.01) return "<$0.01";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 100 ? 2 : 0,
  });
}

/** Blended price per 1M tokens assuming a 3:1 input:output ratio (a common chat workload). */
export function blendedPrice(input: number | null, output: number | null): number | null {
  if (input == null || output == null) return null;
  return (3 * input + output) / 4;
}

export function modelHref(slug: string): string {
  return `/models/${slug}`;
}

const TYPE_LABELS: Record<string, string> = {
  TEXT: "Text",
  IMAGE: "Image",
  VIDEO: "Video",
  SPEECH: "Speech",
  TRANSCRIPTION: "Transcription",
  EMBEDDING: "Embedding",
  RERANKING: "Reranking",
  REALTIME: "Realtime",
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

const MODALITY_LABELS: Record<string, string> = {
  TEXT: "Text",
  IMAGE: "Image",
  AUDIO: "Audio",
  VIDEO: "Video",
  PDF: "PDF",
};

export function modalityLabel(m: string): string {
  return MODALITY_LABELS[m] ?? m;
}
