/**
 * Pure normalization: raw models.dev JSON → our domain shapes.
 *
 * No database access here, which keeps it fast to unit-test (see
 * normalize.test.ts). The pipeline feeds the output into Prisma.
 */
import type { Modality, ModelStatus, ModelType } from "@/generated/prisma/enums";
import { LAB_METADATA, titleize } from "./lab-metadata";
import {
  modelsDevModelSchema,
  modelsDevPayloadSchema,
  modelsDevProviderSchema,
  type ModelsDevModel,
} from "./schemas";

export interface NormalizedLab {
  slug: string;
  name: string;
  website: string | null;
  country: string | null;
}

export interface NormalizedProvider {
  slug: string;
  name: string;
  docsUrl: string | null;
  apiBaseUrl: string | null;
  sdkPackage: string | null;
  isSubscription: boolean;
  hasFreeTier: boolean;
}

export interface NormalizedModel {
  slug: string;
  labSlug: string;
  name: string;
  description: string | null;
  family: string | null;
  type: ModelType;
  status: ModelStatus;
  inputModalities: Modality[];
  outputModalities: Modality[];
  reasoning: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  temperature: boolean;
  attachments: boolean;
  openWeights: boolean;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  knowledgeCutoff: string | null;
  releaseDate: Date | null;
  lastUpdated: Date | null;
}

export interface NormalizedOffering {
  modelSlug: string;
  providerSlug: string;
  providerModelId: string;
  inputPrice: number | null;
  outputPrice: number | null;
  cacheReadPrice: number | null;
  cacheWritePrice: number | null;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  deprecated: boolean;
}

export interface NormalizationStats {
  providersSeen: number;
  listingsSeen: number;
  listingsKept: number;
  skippedNoCanonicalId: number;
  invalidRecords: number;
}

export interface NormalizedCatalog {
  labs: NormalizedLab[];
  providers: NormalizedProvider[];
  models: NormalizedModel[];
  offerings: NormalizedOffering[];
  stats: NormalizationStats;
  /** First few validation problems, kept for the ingestion log. */
  issues: string[];
}

/** Different sources spell the same lab differently. Map them to one slug. */
export const LAB_ALIASES: Record<string, string> = {
  qwen: "alibaba",
  mistralai: "mistral",
  "meta-llama": "meta",
  "x-ai": "xai",
  "z-ai": "zhipuai",
  "google-deepmind": "google",
};

const MAX_TOKENS = 100_000_000; // sanity ceiling for context/output limits
const MAX_PRICE = 100_000; // USD per 1M tokens; anything above is bad data
const MAX_ISSUES = 25;

export function normalizeLabSlug(lab: string): string {
  const s = lab.trim().toLowerCase();
  return LAB_ALIASES[s] ?? s;
}

/** "Qwen/Qwen3-Max" → "alibaba/qwen3-max" */
export function normalizeCanonicalId(id: string): string {
  const [lab, ...rest] = id.trim().toLowerCase().split("/");
  return `${normalizeLabSlug(lab)}/${rest.join("/")}`;
}

/**
 * Work out which canonical model a provider listing belongs to.
 *
 * 1. The listing names it explicitly (`canonical_model_id`) → use that.
 * 2. The provider *is* a lab (e.g. Anthropic selling Claude) → `lab/model-id`.
 * 3. Otherwise it's an aggregator's own router/alias → return null (skipped).
 */
export function resolveCanonicalId(
  providerSlug: string,
  listing: Pick<ModelsDevModel, "id" | "canonical_model_id">,
  knownLabs: ReadonlySet<string>,
): string | null {
  if (listing.canonical_model_id) {
    return normalizeCanonicalId(listing.canonical_model_id);
  }
  const lab = normalizeLabSlug(providerSlug);
  if (!knownLabs.has(lab)) return null;

  // Some first-party ids are already namespaced, e.g. NVIDIA's "qwen/qwen-image".
  if (listing.id.includes("/")) {
    const [prefix] = listing.id.split("/");
    if (knownLabs.has(normalizeLabSlug(prefix))) {
      return normalizeCanonicalId(listing.id);
    }
  }
  return normalizeCanonicalId(`${lab}/${listing.id}`);
}

/** "Anthropic: Claude Opus 4.8" → "Claude Opus 4.8" */
export function cleanModelName(name: string): string {
  return name.replace(/^[^:]{2,40}:\s+/, "").trim();
}

/** Accepts "2025-06-01" or "2025-06"; rejects anything implausible. */
export function parseLooseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d = "01"] = m;
  const year = Number(y);
  if (year < 2015 || year > 2100) return null;
  const date = new Date(`${y}-${mo}-${d}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSubscriptionProvider(slug: string, name: string): boolean {
  return /(coding|token|step|code)[\s-]*plan|for coding/i.test(`${slug} ${name}`);
}

/**
 * Providers with a real, publicly documented free API tier. A $0 price from
 * anyone else is treated as "bundled" (e.g. GitLab Duo, local runtimes) and
 * ignored when computing a model's cheapest price.
 */
export const FREE_TIER_PROVIDERS = new Set([
  "openrouter",
  "nvidia",
  "google",
  "modelscope",
  "zai",
  "zhipuai",
]);

const TYPE_MAP: Record<string, ModelType> = {
  chat: "TEXT",
  text: "TEXT",
  image: "IMAGE",
  video: "VIDEO",
  speech: "SPEECH",
  transcription: "TRANSCRIPTION",
  embedding: "EMBEDDING",
  reranking: "RERANKING",
  realtime: "REALTIME",
};

export function mapModelType(type: string | null | undefined): ModelType {
  return (type && TYPE_MAP[type.toLowerCase()]) || "TEXT";
}

export function mapStatus(status: string | null | undefined): ModelStatus {
  switch (status?.toLowerCase()) {
    case "deprecated":
      return "DEPRECATED";
    case "beta":
      return "BETA";
    case "alpha":
      return "ALPHA";
    default:
      return "ACTIVE";
  }
}

const MODALITY_MAP: Record<string, Modality> = {
  text: "TEXT",
  image: "IMAGE",
  audio: "AUDIO",
  video: "VIDEO",
  pdf: "PDF",
};

export function mapModalities(values: string[] | null | undefined): Modality[] {
  const out = new Set<Modality>();
  for (const v of values ?? []) {
    const m = MODALITY_MAP[v.toLowerCase()];
    if (m) out.add(m);
  }
  return [...out];
}

function cleanTokens(n: number | null | undefined): number | null {
  if (n == null || n <= 0 || n > MAX_TOKENS) return null;
  return Math.round(n);
}

function cleanPrice(n: number | null | undefined): number | null {
  if (n == null || n > MAX_PRICE) return null;
  return n;
}

interface Listing {
  providerSlug: string;
  canonicalId: string;
  data: ModelsDevModel;
}

function largestContext(listings: Listing[]): number | null {
  const values = listings
    .map((l) => cleanTokens(l.data.limit?.context))
    .filter((n): n is number => n !== null);
  return values.length ? Math.max(...values) : null;
}

/**
 * Pick the listing that best describes the model itself. The lab's own API
 * is the source of truth; otherwise prefer the most complete record.
 */
function pickPrimary(listings: Listing[], labSlug: string): Listing {
  const score = (l: Listing) =>
    (normalizeLabSlug(l.providerSlug) === labSlug ? 100 : 0) +
    (l.data.description ? 5 : 0) +
    (l.data.release_date ? 3 : 0) +
    (l.data.limit?.context ? 2 : 0) +
    (l.data.cost ? 1 : 0);
  return listings.reduce((best, l) => (score(l) > score(best) ? l : best));
}

export function normalizeModelsDev(raw: unknown): NormalizedCatalog {
  const payload = modelsDevPayloadSchema.parse(raw);
  const issues: string[] = [];
  const stats: NormalizationStats = {
    providersSeen: 0,
    listingsSeen: 0,
    listingsKept: 0,
    skippedNoCanonicalId: 0,
    invalidRecords: 0,
  };
  const note = (msg: string) => {
    stats.invalidRecords++;
    if (issues.length < MAX_ISSUES) issues.push(msg);
  };

  // Pass 1: validate everything.
  const providers = new Map<string, ReturnType<typeof modelsDevProviderSchema.parse>>();
  const rawListings: { providerSlug: string; data: ModelsDevModel }[] = [];
  for (const [key, value] of Object.entries(payload)) {
    const parsed = modelsDevProviderSchema.safeParse(value);
    if (!parsed.success) {
      note(`provider ${key}: ${parsed.error.issues[0]?.message}`);
      continue;
    }
    stats.providersSeen++;
    const providerSlug = parsed.data.id.toLowerCase();
    providers.set(providerSlug, parsed.data);
    for (const [modelKey, modelValue] of Object.entries(parsed.data.models)) {
      stats.listingsSeen++;
      const m = modelsDevModelSchema.safeParse(modelValue);
      if (!m.success) {
        const issue = m.error.issues[0];
        note(`${providerSlug}/${modelKey}: ${issue?.path.join(".")} ${issue?.message}`);
        continue;
      }
      rawListings.push({ providerSlug, data: m.data });
    }
  }

  // Labs = every namespace that appears in a canonical id.
  const knownLabs = new Set<string>();
  for (const l of rawListings) {
    if (l.data.canonical_model_id) {
      knownLabs.add(normalizeCanonicalId(l.data.canonical_model_id).split("/")[0]);
    }
  }

  // Pass 2: group listings by canonical model.
  const groups = new Map<string, Listing[]>();
  for (const l of rawListings) {
    const canonicalId = resolveCanonicalId(l.providerSlug, l.data, knownLabs);
    if (!canonicalId) {
      stats.skippedNoCanonicalId++;
      continue;
    }
    const group = groups.get(canonicalId) ?? [];
    group.push({ ...l, canonicalId });
    groups.set(canonicalId, group);
  }

  const models: NormalizedModel[] = [];
  const offerings: NormalizedOffering[] = [];
  const usedProviders = new Set<string>();
  const usedLabs = new Set<string>();

  for (const [slug, listings] of groups) {
    const labSlug = slug.split("/")[0];
    const { data: p } = pickPrimary(listings, labSlug);
    usedLabs.add(labSlug);

    models.push({
      slug,
      labSlug,
      name: cleanModelName(p.name),
      description: p.description?.trim() || null,
      family: p.family ?? null,
      type: mapModelType(p.type),
      status: mapStatus(p.status),
      inputModalities: mapModalities(p.modalities?.input),
      outputModalities: mapModalities(p.modalities?.output),
      reasoning: p.reasoning ?? false,
      toolCalling: p.tool_call ?? false,
      structuredOutput: p.structured_output ?? false,
      temperature: p.temperature ?? false,
      attachments: p.attachment ?? false,
      openWeights: listings.some((l) => l.data.open_weights),
      contextWindow: cleanTokens(p.limit?.context) ?? largestContext(listings),
      maxOutputTokens: cleanTokens(p.limit?.output),
      knowledgeCutoff: p.knowledge ?? null,
      releaseDate: parseLooseDate(p.release_date),
      lastUpdated: parseLooseDate(p.last_updated),
    });

    for (const { providerSlug, data } of listings) {
      usedProviders.add(providerSlug);
      stats.listingsKept++;
      offerings.push({
        modelSlug: slug,
        providerSlug,
        providerModelId: data.id,
        inputPrice: cleanPrice(data.cost?.input),
        outputPrice: cleanPrice(data.cost?.output),
        cacheReadPrice: cleanPrice(data.cost?.cache_read),
        cacheWritePrice: cleanPrice(data.cost?.cache_write),
        contextWindow: cleanTokens(data.limit?.context),
        maxOutputTokens: cleanTokens(data.limit?.output),
        deprecated: mapStatus(data.status) === "DEPRECATED",
      });
    }
  }

  const normalizedProviders: NormalizedProvider[] = [...usedProviders].map((slug) => {
    const p = providers.get(slug)!;
    return {
      slug,
      name: p.name,
      docsUrl: p.doc ?? null,
      apiBaseUrl: p.api && !p.api.includes("${") ? p.api : null,
      sdkPackage: p.npm ?? null,
      isSubscription: isSubscriptionProvider(slug, p.name),
      hasFreeTier: FREE_TIER_PROVIDERS.has(slug),
    };
  });

  const labs: NormalizedLab[] = [...usedLabs].map((slug) => {
    const meta = LAB_METADATA[slug];
    return {
      slug,
      name: meta?.name ?? providers.get(slug)?.name ?? titleize(slug),
      website: meta?.website ?? null,
      country: meta?.country ?? null,
    };
  });

  return { labs, providers: normalizedProviders, models, offerings, stats, issues };
}
