/**
 * Price/quality Pareto frontier: the models for which no other model is both
 * cheaper AND smarter. Everything off the frontier is "dominated" — you can
 * get at least as much intelligence for less money elsewhere.
 */
export interface ValuePoint {
  slug: string;
  price: number;
  score: number;
}

export function paretoFrontier<T extends ValuePoint>(points: T[]): T[] {
  const sorted = [...points].sort((a, b) => a.price - b.price || b.score - a.score);
  const frontier: T[] = [];
  let best = -Infinity;
  for (const p of sorted) {
    if (p.score > best) {
      frontier.push(p);
      best = p.score;
    }
  }
  return frontier;
}
