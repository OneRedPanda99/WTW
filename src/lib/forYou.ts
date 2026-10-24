import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTaste, genreFit, normalizeGenre, type TasteProfile } from "./taste";
import { fetchFeatures, genreNames, popularPool, recommendationsFor } from "./tmdb";
import type { MediaItem, MediaType, TitleFeatures } from "./types";

export type Recommendation = { item: MediaItem; reasons: string[] };

const key = (id: number, type: MediaType) => `${type}:${id}`;

/**
 * Personal recommendations: things you haven't rated or saved, ranked by how well
 * they match what you LOVE and like.
 *
 * Two passes, because detailed info costs one TMDB call per title:
 *  1. Cheap pass over a few hundred candidates: "people who loved X also loved",
 *     genre fit, and overall quality.
 *  2. The top ~45 get their cast, director and themes looked up and matched
 *     against the people and themes in your taste profile.
 */
export async function recommendFor(
  supabase: SupabaseClient,
  userId: string,
  type: MediaType | "all",
): Promise<Recommendation[]> {
  const [taste, ratings, watchlist, passes, genres] = await Promise.all([
    computeTaste(supabase, userId),
    supabase.from("ratings").select("tmdb_id, media_type, rating, title").eq("user_id", userId),
    supabase.from("watchlist").select("tmdb_id, media_type").eq("user_id", userId),
    supabase.from("not_interested").select("tmdb_id, media_type").eq("user_id", userId),
    genreNames().catch(() => new Map<number, string>()),
  ]);

  const rated = ratings.data ?? [];
  const exclude = new Set(
    [...rated, ...(watchlist.data ?? []), ...(passes.data ?? [])].map((r) => key(r.tmdb_id, r.media_type)),
  );

  // Seeds: everything you loved counts double; a few liked titles fill in.
  const shuffled = [...rated].sort(() => Math.random() - 0.5);
  const seeds = [
    ...shuffled.filter((r) => r.rating === 2).slice(0, 8).map((r) => ({ ...r, weight: 2 })),
    ...shuffled.filter((r) => r.rating === 1).slice(0, 4).map((r) => ({ ...r, weight: 1 })),
  ];

  const [pool, ...recLists] = await Promise.all([
    popularPool(type),
    ...seeds.map((s) => recommendationsFor(s.tmdb_id, s.media_type).catch(() => [] as MediaItem[])),
  ]);

  const candidates = new Map<string, MediaItem>();
  const sources = new Map<string, { title: string; weight: number }[]>();
  const add = (item: MediaItem) => {
    const k = key(item.id, item.media_type);
    if (exclude.has(k) || !item.poster_path || (type !== "all" && item.media_type !== type)) return false;
    if (item.vote_count >= 50 && item.vote_average < 6) return false; // widely seen and widely panned
    if (!candidates.has(k)) candidates.set(k, item);
    return true;
  };
  pool.forEach(add);
  recLists.forEach((recs, i) => {
    for (const item of recs) {
      if (!add(item)) continue;
      const k = key(item.id, item.media_type);
      sources.set(k, [...(sources.get(k) ?? []), { title: seeds[i].title, weight: seeds[i].weight }]);
    }
  });

  // ── pass 1 ──
  const firstPass = [...candidates.entries()]
    .map(([k, item]) => {
      const recWeight = Math.min((sources.get(k) ?? []).reduce((s, x) => s + x.weight, 0), 4);
      const itemGenres = [...new Set(item.genre_ids.flatMap((id) => normalizeGenre(genres.get(id) ?? "")))];
      const quality = (item.vote_average - 6.5) * 0.8 + Math.log10(item.vote_count + 1) * 0.2;
      return { k, item, score: recWeight + genreFit(taste, itemGenres) + quality };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 45);

  // ── pass 2 ──
  const detailed = await Promise.all(
    firstPass.map(async (c) => {
      const f = await fetchFeatures(c.item.id, c.item.media_type).catch(() => null);
      const match = f ? featureMatch(taste, f) : { score: 0, person: null, theme: null };
      return { ...c, score: c.score + match.score + Math.random() * 0.4, match };
    }),
  );

  const perSeed = new Map<string, number>();
  const out: Recommendation[] = [];
  for (const c of detailed.sort((a, b) => b.score - a.score)) {
    const top = (sources.get(c.k) ?? []).sort((a, b) => b.weight - a.weight)[0];
    if (top) {
      // At most 3 picks per "because you loved X", so one title doesn't take over.
      const n = perSeed.get(top.title) ?? 0;
      if (n >= 3) continue;
      perSeed.set(top.title, n + 1);
    }
    const reasons: string[] = [];
    if (top) reasons.push(`Because you ${top.weight === 2 ? "loved" : "liked"} ${top.title}`);
    if (c.match.person) reasons.push(`With ${c.match.person}`);
    if (c.match.theme && reasons.length < 2) reasons.push(`${capitalize(c.match.theme)}`);
    out.push({ item: c.item, reasons });
    if (out.length >= 30) break;
  }
  return out;
}

/** How well a title's people and themes line up with your taste. */
function featureMatch(taste: TasteProfile, f: TitleFeatures) {
  const scale = Math.max(1, taste.ratedCount) ** 0.5;
  let best: { person: string | null; theme: string | null; pw: number; tw: number } = {
    person: null,
    theme: null,
    pw: 0,
    tw: 0,
  };
  let people = 0;
  for (const p of f.people) {
    const w = taste.weights[`person:${p}`] ?? 0;
    people += w;
    if (w > best.pw && w >= 1.5) best = { ...best, person: p, pw: w };
  }
  let themes = 0;
  for (const k of f.keywords) {
    const w = taste.weights[`keyword:${k}`] ?? 0;
    themes += w;
    if (w > best.tw && w >= 1) best = { ...best, theme: k, tw: w };
  }
  const score = (Math.max(-4, Math.min(people, 8)) * 0.5 + Math.max(-4, Math.min(themes, 8)) * 0.35) / scale;
  return { score: score * 2, person: best.person, theme: best.theme };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
