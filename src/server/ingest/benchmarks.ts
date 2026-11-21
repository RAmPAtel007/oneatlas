/**
 * Benchmark definitions + extraction from OpenRouter's public model feed,
 * which republishes Artificial Analysis indices and Design Arena Elo ratings.
 */
import { normalizeLabSlug } from "./normalize";
import {
  openRouterModelSchema,
  openRouterPayloadSchema,
  type OpenRouterModel,
} from "./schemas";

export interface BenchmarkDefinition {
  slug: string;
  name: string;
  category: string;
  description: string;
  source: string;
  sourceUrl: string;
  unit: "index" | "elo";
  sortOrder: number;
  extract: (m: OpenRouterModel) => number | null | undefined;
}

const AA_URL = "https://artificialanalysis.ai";
const DA_URL = "https://www.designarena.ai";

function aa(
  key: string,
  slug: string,
  name: string,
  category: string,
  description: string,
  sortOrder: number,
): BenchmarkDefinition {
  return {
    slug,
    name,
    category,
    description,
    source: "Artificial Analysis",
    sourceUrl: AA_URL,
    unit: "index",
    sortOrder,
    extract: (m) => m.benchmarks?.artificial_analysis?.[key],
  };
}

function da(
  arena: string,
  category: string,
  slug: string,
  name: string,
  group: string,
  sortOrder: number,
): BenchmarkDefinition {
  return {
    slug,
    name,
    category: group,
    description: `Head-to-head human preference Elo from Design Arena (${arena}/${category}).`,
    source: "Design Arena",
    sourceUrl: DA_URL,
    unit: "elo",
    sortOrder,
    extract: (m) =>
      m.benchmarks?.design_arena?.find((d) => d.arena === arena && d.category === category)?.elo,
  };
}

export const BENCHMARKS: BenchmarkDefinition[] = [
  aa("intelligence_index", "aa-intelligence", "Intelligence Index", "General",
    "Artificial Analysis composite of reasoning, knowledge, math and coding evaluations.", 1),
  aa("engineering_index", "aa-engineering", "Engineering", "Domain expertise",
    "Artificial Analysis domain index for engineering tasks.", 10),
  aa("finance_and_accounting_index", "aa-finance", "Finance & Accounting", "Domain expertise",
    "Artificial Analysis domain index for finance and accounting tasks.", 11),
  aa("legal_index", "aa-legal", "Legal", "Domain expertise",
    "Artificial Analysis domain index for legal tasks.", 12),
  aa("healthcare_and_medical_index", "aa-healthcare", "Healthcare & Medical", "Domain expertise",
    "Artificial Analysis domain index for healthcare and medical tasks.", 13),
  aa("economics_index", "aa-economics", "Economics", "Domain expertise",
    "Artificial Analysis domain index for economics tasks.", 14),
  aa("strategy_and_ops_index", "aa-strategy-ops", "Strategy & Ops", "Domain expertise",
    "Artificial Analysis domain index for strategy and operations tasks.", 15),
  aa("cyber_index", "aa-cyber", "Cybersecurity", "Domain expertise",
    "Artificial Analysis domain index for cybersecurity tasks.", 16),
  aa("multilingual_index", "aa-multilingual", "Multilingual", "Language",
    "Artificial Analysis index of performance across languages.", 20),
  aa("openness_index", "aa-openness", "Openness Index", "Openness",
    "Artificial Analysis rating of how openly a model is released (weights, data, methodology).", 30),
  da("models", "codecategories", "da-code", "Code (overall)", "Coding & design", 40),
  da("models", "website", "da-website", "Website generation", "Coding & design", 41),
  da("models", "uicomponent", "da-ui", "UI components", "Coding & design", 42),
  da("models", "gamedev", "da-gamedev", "Game dev", "Coding & design", 43),
  da("models", "dataviz", "da-dataviz", "Data visualization", "Coding & design", 44),
  da("models", "3d", "da-3d", "3D scenes", "Coding & design", 45),
  da("models", "svg", "da-svg", "SVG graphics", "Coding & design", 46),
  da("agents", "webapps", "da-agent-webapps", "Agentic web apps", "Agents", 50),
  da("agents", "fullstack", "da-agent-fullstack", "Agentic full-stack", "Agents", 51),
  da("agents", "mobileapps", "da-agent-mobile", "Agentic mobile apps", "Agents", 52),
];

/**
 * OpenRouter writes "anthropic/claude-sonnet-5.5:free"; models.dev writes
 * "anthropic/claude-sonnet-5-5". Reduce both to the same comparable key.
 */
export function benchmarkMatchKey(id: string): string {
  const clean = id.trim().toLowerCase().split(":")[0];
  const [lab, ...rest] = clean.split("/");
  return `${normalizeLabSlug(lab)}/${rest.join("/").replace(/\./g, "-")}`;
}

export interface ExtractedScore {
  modelSlug: string;
  benchmarkSlug: string;
  score: number;
}

export interface BenchmarkExtraction {
  scores: ExtractedScore[];
  matchedModels: number;
  unmatchedModels: number;
  invalidRecords: number;
}

export function extractBenchmarkScores(
  raw: unknown,
  modelSlugs: Iterable<string>,
): BenchmarkExtraction {
  const payload = openRouterPayloadSchema.parse(raw);
  const byKey = new Map<string, string>();
  for (const slug of modelSlugs) byKey.set(benchmarkMatchKey(slug), slug);

  const best = new Map<string, ExtractedScore>(); // `${model}|${benchmark}` → score
  const matched = new Set<string>();
  let unmatchedModels = 0;
  let invalidRecords = 0;

  for (const item of payload.data) {
    const parsed = openRouterModelSchema.safeParse(item);
    if (!parsed.success) {
      invalidRecords++;
      continue;
    }
    const m = parsed.data;
    if (!m.benchmarks) continue;

    const candidates = [m.id, m.canonical_slug?.replace(/-\d{8}$/, "")].filter(
      (x): x is string => Boolean(x),
    );
    const modelSlug = candidates.map((c) => byKey.get(benchmarkMatchKey(c))).find(Boolean);
    if (!modelSlug) {
      unmatchedModels++;
      continue;
    }
    matched.add(modelSlug);

    for (const def of BENCHMARKS) {
      const value = def.extract(m);
      if (value == null || !Number.isFinite(value)) continue;
      const key = `${modelSlug}|${def.slug}`;
      const prev = best.get(key);
      // ":free" / ":batch" variants repeat the same model — keep the best score.
      if (!prev || value > prev.score) {
        best.set(key, { modelSlug, benchmarkSlug: def.slug, score: value });
      }
    }
  }

  return {
    scores: [...best.values()],
    matchedModels: matched.size,
    unmatchedModels,
    invalidRecords,
  };
}
