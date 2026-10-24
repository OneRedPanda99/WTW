import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchFeatures } from "./tmdb";
import type { MediaType, Rating, TitleFeatures } from "./types";

export type TasteFeature = { label: string; score: number; count: number };

export type TasteProfile = {
  ratedCount: number;
  notInterestedCount: number;
  genres: TasteFeature[];
  keywords: TasteFeature[];
  people: TasteFeature[];
  decades: TasteFeature[];
  /** Raw weights keyed like "genre:Comedy". Used later for scoring recommendations. */
  weights: Record<string, number>;
};

/** "Not for me" counts as half a "didn't like": you never watched it, but you know you don't want to. */
const NOT_INTERESTED_WEIGHT = -0.5;

/**
 * Builds a taste profile from ratings plus "not for me" picks. Watchlist items
 * never count until they're logged as watched (which moves them into ratings).
 *
 * Each title adds its weight (-1 / +1 / +2, or -0.5 for "not for me") to every
 * feature it has. Counts only include titles you actually watched.
 */
export async function computeTaste(supabase: SupabaseClient, userId: string): Promise<TasteProfile> {
  const [{ data: ratings }, { data: passes }] = await Promise.all([
    supabase.from("ratings").select("tmdb_id, media_type, rating").eq("user_id", userId),
    supabase.from("not_interested").select("tmdb_id, media_type").eq("user_id", userId),
  ]);

  const rated = ((ratings ?? []) as { tmdb_id: number; media_type: MediaType; rating: Rating }[]).map((r) => ({
    ...r,
    weight: r.rating as number,
    watched: true,
  }));
  const passed = ((passes ?? []) as { tmdb_id: number; media_type: MediaType }[]).map((r) => ({
    ...r,
    weight: NOT_INTERESTED_WEIGHT,
    watched: false,
  }));
  const rows = [...rated, ...passed];
  const features = await loadFeatures(supabase, rows);

  const tally = new Map<string, { score: number; count: number }>();
  const add = (k: string, w: number, watched: boolean) => {
    const t = tally.get(k) ?? { score: 0, count: 0 };
    t.score += w;
    if (watched) t.count += 1;
    tally.set(k, t);
  };

  for (const r of rows) {
    const f = features.get(`${r.media_type}:${r.tmdb_id}`);
    if (!f) continue;
    new Set(f.genres.flatMap(normalizeGenre)).forEach((g) => add(`genre:${g}`, r.weight, r.watched));
    f.keywords.filter((k) => !JUNK_KEYWORDS.has(k)).forEach((k) => add(`keyword:${k}`, r.weight * 0.5, r.watched));
    f.people.forEach((p) => add(`person:${p}`, r.weight * 0.75, r.watched));
    if (f.year) add(`decade:${f.year.slice(0, 3)}0s`, r.weight * 0.5, r.watched);
  }

  const group = (prefix: string, minCount: number) =>
    [...tally.entries()]
      .filter(([k, v]) => k.startsWith(prefix) && v.count >= minCount)
      .map(([k, v]) => ({ label: k.slice(prefix.length), score: round(v.score), count: v.count }))
      .sort((a, b) => b.score - a.score);

  return {
    ratedCount: rated.length,
    notInterestedCount: passed.length,
    genres: group("genre:", 0), // 0 so genres you only ever passed on still show up as dislikes
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

/** Average "how much do you like this genre" per rated title, over the title's genres. Roughly -2 … 4. */
export function genreFit(taste: TasteProfile, genres: string[]) {
  if (taste.ratedCount === 0 || genres.length === 0) return 0;
  const vals = genres.map((g) => (taste.weights[`genre:${g}`] ?? 0) / taste.ratedCount);
  return (vals.reduce((a, b) => a + b, 0) / vals.length) * 2;
}

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
