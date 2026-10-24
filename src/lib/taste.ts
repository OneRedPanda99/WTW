import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchFeatures } from "./tmdb";
import type { MediaType, Rating, TitleFeatures } from "./types";

export type TasteFeature = { label: string; score: number; count: number };

export type TasteProfile = {
  ratedCount: number;
  genres: TasteFeature[];
  keywords: TasteFeature[];
  people: TasteFeature[];
  decades: TasteFeature[];
  /** Raw weights keyed like "genre:Comedy". Used later for scoring recommendations. */
  weights: Record<string, number>;
};

/**
 * Builds a taste profile from RATINGS ONLY. Watchlist items never count until
 * they're logged as watched (which moves them into ratings).
 *
 * Each rated title adds its rating (-1 / +1 / +2) to every feature it has.
 */
export async function computeTaste(supabase: SupabaseClient, userId: string): Promise<TasteProfile> {
  const { data: ratings } = await supabase
    .from("ratings")
    .select("tmdb_id, media_type, rating")
    .eq("user_id", userId);

  const rows = (ratings ?? []) as { tmdb_id: number; media_type: MediaType; rating: Rating }[];
  const features = await loadFeatures(supabase, rows);

  const tally = new Map<string, { score: number; count: number }>();
  const add = (k: string, w: number) => {
    const t = tally.get(k) ?? { score: 0, count: 0 };
    t.score += w;
    t.count += 1;
    tally.set(k, t);
  };

  for (const r of rows) {
    const f = features.get(`${r.media_type}:${r.tmdb_id}`);
    if (!f) continue;
    new Set(f.genres.flatMap(normalizeGenre)).forEach((g) => add(`genre:${g}`, r.rating));
    f.keywords.filter((k) => !JUNK_KEYWORDS.has(k)).forEach((k) => add(`keyword:${k}`, r.rating * 0.5));
    f.people.forEach((p) => add(`person:${p}`, r.rating * 0.75));
    if (f.year) add(`decade:${f.year.slice(0, 3)}0s`, r.rating * 0.5);
  }

  const group = (prefix: string, minCount: number) =>
    [...tally.entries()]
      .filter(([k, v]) => k.startsWith(prefix) && v.count >= minCount)
      .map(([k, v]) => ({ label: k.slice(prefix.length), score: round(v.score), count: v.count }))
      .sort((a, b) => b.score - a.score);

  return {
    ratedCount: rows.length,
    genres: group("genre:", 1),
    keywords: group("keyword:", 2),
    people: group("person:", 2),
    decades: group("decade:", 1),
    weights: Object.fromEntries([...tally.entries()].map(([k, v]) => [k, v.score])),
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

// TMDB uses combined genre names for TV; split them so movies and shows count together.
const TV_GENRES: Record<string, string[]> = {
  "Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"],
  "Action & Adventure": ["Action", "Adventure"],
  "War & Politics": ["War"],
  Kids: ["Family"],
};
export const normalizeGenre = (g: string) => TV_GENRES[g] ?? [g];

// TMDB keywords that describe the release, not the story.
const JUNK_KEYWORDS = new Set([
  "aftercreditsstinger",
  "duringcreditsstinger",
  "woman director",
  "3d",
  "imax",
  "sequel",
  "remake",
  "live action remake",
  "anime",
]);

/** Reads cached features and fetches (a few) missing ones from TMDB. */
async function loadFeatures(
  supabase: SupabaseClient,
  rows: { tmdb_id: number; media_type: MediaType }[],
): Promise<Map<string, TitleFeatures>> {
  const map = new Map<string, TitleFeatures>();
  if (rows.length === 0) return map;

  const { data } = await supabase
    .from("title_cache")
    .select("tmdb_id, media_type, data")
    .in("tmdb_id", rows.map((r) => r.tmdb_id));
  for (const c of data ?? []) map.set(`${c.media_type}:${c.tmdb_id}`, c.data as TitleFeatures);

  const missing = rows.filter((r) => !map.has(`${r.media_type}:${r.tmdb_id}`)).slice(0, 10);
  await Promise.all(
    missing.map(async (r) => {
      try {
        const f = await fetchFeatures(r.tmdb_id, r.media_type);
        map.set(`${r.media_type}:${r.tmdb_id}`, f);
        await supabase.from("title_cache").upsert({ tmdb_id: r.tmdb_id, media_type: r.media_type, data: f });
      } catch {
        // skip; we'll try again next time
      }
    }),
  );
  return map;
}
