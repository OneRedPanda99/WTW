import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTaste, genreFit, normalizeGenre, type TasteProfile } from "./taste";
import { genreNames, popularPool, recommendationsFor, titleDetails } from "./tmdb";
import type { MediaItem, MediaType, Rating } from "./types";

export type Member = { id: string; name: string };

/** Name to give the viewer so reasons read "Because you liked …". */
export const YOU = "You";
export type GroupPick = { item: MediaItem; score: number; reasons: string[] };

type MemberData = {
  member: Member;
  taste: TasteProfile;
  ratings: Map<string, { rating: Rating; title: string }>;
  watchlist: Set<string>;
};

const key = (id: number, type: MediaType) => `${type}:${id}`;

/**
 * Picks for a group, ranked so that nobody hates it ("least misery"):
 * every title gets a score per person, and the group score leans on the
 * LOWEST of those, with a smaller bonus for the average.
 *
 * Per person:
 *  - genre fit from their taste profile (ratings only)
 *  - on their watchlist: strong boost (watchlist doesn't change taste, but
 *    it's a great signal for "what should we watch tonight")
 *  - recommended from something they liked
 *  - already seen it and loved/liked it (good rewatch / "you have to see this")
 *
 * Skipped: anything someone disliked, and anything EVERYONE has already seen.
 */
export async function groupPicks(supabase: SupabaseClient, members: Member[], type: MediaType | "all"): Promise<GroupPick[]> {
  const data = await Promise.all(members.map((m) => loadMember(supabase, m)));
  const genres = await genreNames().catch(() => new Map<number, string>());
  const wants = (t: MediaType) => type === "all" || type === t;

  // ── candidates ──
  const candidates = new Map<string, MediaItem>();
  const recSources = new Map<string, { name: string; from: string }[]>();
  const addCandidate = (item: MediaItem) => {
    if (!item.poster_path || !wants(item.media_type)) return;
    const k = key(item.id, item.media_type);
    if (!candidates.has(k)) candidates.set(k, item);
  };

  const watchlistKeys = [...new Set(data.flatMap((d) => [...d.watchlist]))].slice(0, 40);
  const seedJobs = data.flatMap((d) =>
    [...d.ratings.entries()]
      .filter(([, r]) => r.rating > 0)
      .sort(() => Math.random() - 0.5)
      .slice(0, 4)
      .map(([k, r]) => ({ d, k, title: r.title })),
  );

  const [pool, watchItems, recLists] = await Promise.all([
    popularPool(type),
    Promise.all(
      watchlistKeys.map((k) => {
        const [t, id] = k.split(":");
        return titleDetails(Number(id), t as MediaType).catch(() => null);
      }),
    ),
    Promise.all(
      seedJobs.map(async (job) => {
        const [t, id] = job.k.split(":");
        const recs = await recommendationsFor(Number(id), t as MediaType).catch(() => []);
        return { job, recs };
      }),
    ),
  ]);

  pool.forEach(addCandidate);
  watchItems.forEach((i) => i && addCandidate(i));
  for (const { job, recs } of recLists) {
    for (const item of recs) {
      addCandidate(item);
      const k = key(item.id, item.media_type);
      const list = recSources.get(k) ?? [];
      if (!list.some((s) => s.name === job.d.member.name)) list.push({ name: job.d.member.name, from: job.title });
      recSources.set(k, list);
    }
  }

  // ── scoring ──
  const picks: GroupPick[] = [];
  for (const [k, item] of candidates) {
    const seenBy = data.filter((d) => d.ratings.has(k));
    if (seenBy.some((d) => d.ratings.get(k)!.rating < 0)) continue; // someone disliked it
    if (seenBy.length === data.length) continue; // everyone has seen it

    const itemGenres = [...new Set(item.genre_ids.flatMap((id) => normalizeGenre(genres.get(id) ?? "")))].filter(Boolean);
    const sources = recSources.get(k) ?? [];

    const perPerson = data.map((d) => {
      let s = genreFit(d.taste, itemGenres);
      if (d.watchlist.has(k)) s += 2.5;
      if (sources.some((src) => src.name === d.member.name)) s += 1.2;
      const own = d.ratings.get(k);
      if (own) s += own.rating === 2 ? 2 : 1;
      return s;
    });

    const min = Math.min(...perPerson);
    const avg = perPerson.reduce((a, b) => a + b, 0) / perPerson.length;
    const quality = (item.vote_average - 6.5) * 0.3 + Math.log10(item.vote_count + 1) * 0.25;
    const score = min + 0.35 * avg + quality + Math.random() * 0.3;

    picks.push({ item, score, reasons: reasonsFor(k, data, itemGenres, sources) });
  }

  return diversify(picks.sort((a, b) => b.score - a.score), recSources, 30);
}

/** Keep one liked title from flooding the list: at most 3 picks per "because you liked X". */
function diversify(sorted: GroupPick[], recSources: Map<string, { from: string }[]>, limit: number) {
  const perSeed = new Map<string, number>();
  const out: GroupPick[] = [];
  const overflow: GroupPick[] = [];
  for (const p of sorted) {
    const seed = recSources.get(key(p.item.id, p.item.media_type))?.[0]?.from;
    const n = seed ? (perSeed.get(seed) ?? 0) : 0;
    if (seed && n >= 3) {
      overflow.push(p);
      continue;
    }
    if (seed) perSeed.set(seed, n + 1);
    out.push(p);
    if (out.length >= limit) return out;
  }
  return [...out, ...overflow].slice(0, limit);
}

async function loadMember(supabase: SupabaseClient, member: Member): Promise<MemberData> {
  const [taste, r, w] = await Promise.all([
    computeTaste(supabase, member.id),
    supabase.from("ratings").select("tmdb_id, media_type, rating, title").eq("user_id", member.id),
    supabase.from("watchlist").select("tmdb_id, media_type").eq("user_id", member.id),
  ]);
  return {
    member,
    taste,
    ratings: new Map((r.data ?? []).map((x) => [key(x.tmdb_id, x.media_type), { rating: x.rating as Rating, title: x.title }])),
    watchlist: new Set((w.data ?? []).map((x) => key(x.tmdb_id, x.media_type))),
  };
}

function reasonsFor(
  k: string,
  data: MemberData[],
  genres: string[],
  sources: { name: string; from: string }[],
): string[] {
  const reasons: string[] = [];
  const names = (ds: MemberData[]) => joinNames(ds.map((d) => d.member.name));

  const listedBy = data.filter((d) => d.watchlist.has(k));
  if (listedBy.length === data.length && data.length > 1) reasons.push("On everyone's watchlist");
  else if (listedBy.length === 1 && listedBy[0].member.name === YOU) reasons.push("On your watchlist");
  else if (listedBy.length) reasons.push(`On ${names(listedBy)}'s watchlist`);

  const loved = data.filter((d) => d.ratings.get(k)?.rating === 2);
  const liked = data.filter((d) => d.ratings.get(k)?.rating === 1);
  if (loved.length) reasons.push(`${names(loved)} loved it`);
  if (liked.length) reasons.push(`${names(liked)} liked it`);

  for (const s of sources.slice(0, 2)) reasons.push(`Because ${s.name === YOU ? "you" : s.name} liked ${s.from}`);

  const shared = genres.find((g) => data.every((d) => (d.taste.weights[`genre:${g}`] ?? 0) > 0));
  if (shared && data.length > 1) reasons.push(`You all like ${shared}`);

  return reasons.slice(0, 3);
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}
