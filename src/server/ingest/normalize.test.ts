import { describe, expect, it } from "vitest";
import { benchmarkMatchKey, extractBenchmarkScores } from "./benchmarks";
import {
  cleanModelName,
  isSubscriptionProvider,
  normalizeCanonicalId,
  normalizeModelsDev,
  parseLooseDate,
  resolveCanonicalId,
} from "./normalize";

describe("canonical ids", () => {
  it("lowercases and maps lab aliases", () => {
    expect(normalizeCanonicalId("Qwen/Qwen3-Max")).toBe("alibaba/qwen3-max");
    expect(normalizeCanonicalId("meta-llama/Llama-4")).toBe("meta/llama-4");
  });

  const labs = new Set(["anthropic", "nvidia", "alibaba"]);

  it("prefers the explicit canonical id", () => {
    expect(resolveCanonicalId("groq", { id: "x", canonical_model_id: "anthropic/claude" }, labs)).toBe("anthropic/claude");
  });

  it("derives first-party ids from the provider when it is a lab", () => {
    expect(resolveCanonicalId("anthropic", { id: "claude-opus-5-5" }, labs)).toBe("anthropic/claude-opus-5-5");
    // Already namespaced by another lab
    expect(resolveCanonicalId("nvidia", { id: "qwen/qwen-image" }, labs)).toBe("alibaba/qwen-image");
  });

  it("skips aggregator-only aliases", () => {
    expect(resolveCanonicalId("some-router", { id: "auto" }, labs)).toBeNull();
  });
});

describe("field cleaning", () => {
  it("strips 'Lab: ' prefixes from names", () => {
    expect(cleanModelName("Anthropic: Claude Opus 5.5")).toBe("Claude Opus 5.5");
    expect(cleanModelName("GPT-6")).toBe("GPT-6");
  });

  it("parses partial dates and rejects nonsense", () => {
    expect(parseLooseDate("2025-06")?.toISOString()).toBe("2025-06-01T00:00:00.000Z");
    expect(parseLooseDate("2025-06-15")?.toISOString()).toBe("2025-06-15T00:00:00.000Z");
    expect(parseLooseDate("1999-01-01")).toBeNull();
    expect(parseLooseDate("soon")).toBeNull();
  });

  it("detects subscription plans", () => {
    expect(isSubscriptionProvider("zai-coding-plan", "Z.AI Coding Plan")).toBe(true);
    expect(isSubscriptionProvider("kimi-code-plan-cn", "Kimi For Coding")).toBe(true);
    expect(isSubscriptionProvider("groq", "Groq")).toBe(false);
  });
});

describe("normalizeModelsDev", () => {
  const raw = {
    anthropic: {
      id: "anthropic",
      name: "Anthropic",
      models: {
        "claude-x": {
          id: "claude-x",
          name: "Claude X",
          description: "First-party description",
          reasoning: true,
          tool_call: true,
          release_date: "2026-01-10",
          modalities: { input: ["text", "image", "hologram"], output: ["text"] },
          limit: { context: 200000, output: 64000 },
          cost: { input: 3, output: 15 },
        },
      },
    },
    reseller: {
      id: "reseller",
      name: "Reseller",
      models: {
        "anthropic/claude-x": {
          id: "anthropic/claude-x",
          name: "Anthropic: Claude X",
          canonical_model_id: "anthropic/claude-x",
          reasoning: false,
          cost: { input: 2.5, output: 12 },
        },
        broken: { id: "broken", name: "Bad", cost: { input: -1 } },
        "router-auto": { id: "router-auto", name: "Auto router" },
      },
    },
    "zai-coding-plan": {
      id: "zai-coding-plan",
      name: "Z.AI Coding Plan",
      models: { m: { id: "m", name: "M", canonical_model_id: "anthropic/claude-x", cost: { input: 0, output: 0 } } },
    },
  };

  const catalog = normalizeModelsDev(raw);

  it("merges listings for the same model across providers", () => {
    expect(catalog.models).toHaveLength(1);
    expect(catalog.offerings).toHaveLength(3);
  });

  it("uses the first-party listing as source of truth", () => {
    const m = catalog.models[0];
    expect(m.name).toBe("Claude X");
    expect(m.reasoning).toBe(true); // reseller said false; lab wins
    expect(m.description).toBe("First-party description");
    expect(m.inputModalities).toEqual(["TEXT", "IMAGE"]); // unknown modality dropped
    expect(m.contextWindow).toBe(200000);
  });

  it("counts invalid and skipped records instead of throwing", () => {
    expect(catalog.stats.invalidRecords).toBe(1);
    expect(catalog.stats.skippedNoCanonicalId).toBe(1);
  });

  it("flags subscription providers", () => {
    expect(catalog.providers.find((p) => p.slug === "zai-coding-plan")?.isSubscription).toBe(true);
    expect(catalog.providers.find((p) => p.slug === "reseller")?.isSubscription).toBe(false);
  });
});

describe("benchmark matching", () => {
  it("reconciles OpenRouter and models.dev id styles", () => {
    expect(benchmarkMatchKey("anthropic/claude-sonnet-5.5:free")).toBe("anthropic/claude-sonnet-5-5");
    expect(benchmarkMatchKey("anthropic/claude-sonnet-5-5")).toBe("anthropic/claude-sonnet-5-5");
    expect(benchmarkMatchKey("mistralai/mistral-large")).toBe("mistral/mistral-large");
  });

  it("extracts scores, keeping the best across :free variants", () => {
    const result = extractBenchmarkScores(
      {
        data: [
          { id: "anthropic/claude-x", benchmarks: { artificial_analysis: { intelligence_index: 50 } } },
          { id: "anthropic/claude-x:free", benchmarks: { artificial_analysis: { intelligence_index: 49 } } },
          { id: "unknown/model", benchmarks: { artificial_analysis: { intelligence_index: 10 } } },
        ],
      },
      ["anthropic/claude-x"],
    );
    expect(result.scores).toEqual([{ modelSlug: "anthropic/claude-x", benchmarkSlug: "aa-intelligence", score: 50 }]);
    expect(result.unmatchedModels).toBe(1);
  });
});
