import { describe, expect, it } from "vitest";
import { blendedPrice, formatPrice, formatTokens } from "./format";
import { paretoFrontier } from "./pareto";
import { modelsHref, parseModelListQuery } from "./query-schemas";

describe("paretoFrontier", () => {
  it("keeps only models no other model beats on both price and score", () => {
    const pts = [
      { slug: "cheap-weak", price: 1, score: 30 },
      { slug: "mid", price: 3, score: 50 },
      { slug: "dominated", price: 4, score: 45 }, // pricier AND worse than "mid"
      { slug: "top", price: 10, score: 60 },
    ];
    expect(paretoFrontier(pts).map((p) => p.slug)).toEqual(["cheap-weak", "mid", "top"]);
  });
});

describe("parseModelListQuery", () => {
  it("parses CSV lists, numbers and defaults", () => {
    const q = parseModelListQuery({ cap: "reasoning,vision", lab: "openai", page: "2", sort: "price" });
    expect(q).toMatchObject({ cap: ["reasoning", "vision"], lab: ["openai"], page: 2, sort: "price", pageSize: 30, deprecated: false });
  });

  it("drops only invalid params instead of failing the whole page", () => {
    const q = parseModelListQuery({ sort: "bogus", page: "0", lab: "openai" });
    expect(q.sort).toBe("newest");
    expect(q.page).toBe(1);
    expect(q.lab).toEqual(["openai"]);
  });

  it("round-trips through modelsHref without default noise", () => {
    const q = parseModelListQuery({ cap: "tools", sort: "price" });
    expect(modelsHref(q)).toBe("/models?cap=tools&sort=price");
    expect(modelsHref(q, { page: 3 })).toBe("/models?cap=tools&sort=price&page=3");
    expect(modelsHref(parseModelListQuery({}))).toBe("/models");
  });
});

describe("formatters", () => {
  it("formats prices and token counts", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(3)).toBe("$3");
    expect(formatPrice(0.15)).toBe("$0.15");
    expect(formatPrice(null)).toBe("—");
    expect(formatTokens(1_048_576)).toBe("1.0M");
    expect(formatTokens(200_000)).toBe("200K");
  });

  it("blends price at 3:1 input:output", () => {
    expect(blendedPrice(4, 20)).toBe(8);
    expect(blendedPrice(null, 20)).toBeNull();
  });
});
