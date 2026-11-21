/** Shared by server and client components (kept out of "use client" files). */
export const MAX_COMPARE = 4;

export function compareHref(slugs: string[]) {
  return slugs.length ? `/compare?models=${slugs.map(encodeURIComponent).join(",")}` : "/compare";
}
