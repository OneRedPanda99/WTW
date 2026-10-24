import "server-only";
import type { MediaItem, MediaType, TitleFeatures } from "./types";

const BASE = "https://api.themoviedb.org/3";

async function tmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(BASE + path);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.TMDB_READ_TOKEN}`, accept: "application/json" },
    next: { revalidate: 60 * 60 * 6 }, // TMDB lists don't change often; cache for 6h
  });
  if (!res.ok) throw new Error(`TMDB ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

type RawResult = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path: string | null;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  original_language?: string;
  adult?: boolean;
};

function toItem(r: RawResult, fallbackType: MediaType): MediaItem | null {
  const type = (r.media_type ?? fallbackType) as string;
  if (type !== "movie" && type !== "tv") return null; // drop people from multi-search
  const date = r.release_date || r.first_air_date || "";
  return {
    id: r.id,
    media_type: type,
    title: r.title ?? r.name ?? "Untitled",
    poster_path: r.poster_path,
    overview: r.overview ?? "",
    year: date ? date.slice(0, 4) : null,
    vote_average: r.vote_average ?? 0,
    vote_count: r.vote_count ?? 0,
    genre_ids: r.genre_ids ?? [],
    original_language: r.original_language ?? "",
  };
}

async function list(path: string, type: MediaType, params: Record<string, string | number> = {}): Promise<MediaItem[]> {
  const data = await tmdb<{ results: RawResult[] }>(path, params);
  return data.results
    .filter((r) => r.poster_path && !r.adult)
    .map((r) => toItem(r, type))
    .filter((x): x is MediaItem => x !== null);
}

export function posterUrl(path: string | null, size: "w185" | "w342" | "w500" = "w342") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export type PersonResult = {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  known_for: string[];
};

/** Searches movies, shows and people (actors, directors) in one go. */
export async function search(query: string): Promise<{ titles: MediaItem[]; people: PersonResult[] }> {
  type Raw = RawResult & {
    profile_path?: string | null;
    known_for_department?: string;
    known_for?: RawResult[];
    popularity?: number;
  };
  const data = await tmdb<{ results: Raw[] }>("/search/multi", { query, include_adult: "false" });

  const people = data.results
    .filter((r) => r.media_type === "person" && (r.popularity ?? 0) > 1)
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      name: r.name ?? "Unknown",
      profile_path: r.profile_path ?? null,
      known_for_department: r.known_for_department ?? "",
      known_for: (r.known_for ?? []).map((k) => k.title ?? k.name ?? "").filter(Boolean).slice(0, 3),
    }));

  const titles = data.results.map((r) => toItem(r, "movie")).filter((x): x is MediaItem => x !== null);
  return { titles, people };
}

export type Credit = MediaItem & { role: string };

// Talk shows, news and award shows: someone "appearing as themselves" isn't a movie they're in.
const NOT_REALLY_IN_IT = new Set([10763, 10767, 10764]);

/** A person's details and the movies / shows they acted in or directed, best known first. */
export async function personCredits(id: number) {
  type CreditRaw = RawResult & { character?: string; job?: string; episode_count?: number };
  const p = await tmdb<{
    name: string;
    profile_path: string | null;
    known_for_department: string;
    biography: string;
    combined_credits: { cast: CreditRaw[]; crew: CreditRaw[] };
  }>(`/person/${id}`, { append_to_response: "combined_credits" });

  const byKey = new Map<string, Credit>();
  const add = (r: CreditRaw, role: string) => {
    const item = toItem(r, "movie");
    if (!item || !item.poster_path || r.adult) return;
    if (item.genre_ids.some((g) => NOT_REALLY_IN_IT.has(g))) return;
    if (/\b(self|himself|herself|narrator \(voice\))\b/i.test(role)) return;
    const k = `${item.media_type}:${item.id}`;
    const existing = byKey.get(k);
    if (existing) existing.role = `${existing.role} · ${role}`;
    else byKey.set(k, { ...item, role });
  };
  p.combined_credits.cast.forEach((c) => add(c, c.character ? `as ${c.character}` : "Cast"));
  p.combined_credits.crew.filter((c) => c.job === "Director" || c.job === "Creator").forEach((c) => add(c, c.job!));

  return {
    name: p.name,
    profile_path: p.profile_path,
    known_for_department: p.known_for_department,
    biography: p.biography,
    credits: [...byKey.values()].sort((a, b) => b.vote_count - a.vote_count),
  };
}

// Minimum TMDB vote counts for the swipe pool: enough that most people have heard of it.
const WELL_KNOWN_VOTES: Record<MediaType, number> = { movie: 2500, tv: 600 };

/** Widely-seen titles to swipe on: popular, with lots of votes, plus what's trending. */
export async function popularPool(type: MediaType | "all"): Promise<MediaItem[]> {
  const types: MediaType[] = type === "all" ? ["movie", "tv"] : [type];
  const rand = (n: number) => 1 + Math.floor(Math.random() * n);

  const requests = types.flatMap((t) => [
    list(`/discover/${t}`, t, { sort_by: "popularity.desc", "vote_count.gte": WELL_KNOWN_VOTES[t], page: rand(15) }),
    list(`/discover/${t}`, t, { sort_by: "popularity.desc", "vote_count.gte": WELL_KNOWN_VOTES[t], page: rand(15) }),
    list(`/trending/${t}/week`, t, { page: rand(2) }),
  ]);
  const results = await Promise.allSettled(requests);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

/** TMDB's "people who watched X also watched" list. */
export async function recommendationsFor(id: number, type: MediaType): Promise<MediaItem[]> {
  return list(`/${type}/${id}/recommendations`, type);
}

/** Card-level info for one title (used for watchlist items, which we only store ids for). */
export async function titleDetails(id: number, type: MediaType): Promise<MediaItem | null> {
  const d = await tmdb<RawResult & { genres?: { id: number }[] }>(`/${type}/${id}`);
  return toItem({ ...d, genre_ids: (d.genres ?? []).map((g) => g.id) }, type);
}

/** TMDB genre id → name, for both movies and TV. */
export async function genreNames(): Promise<Map<number, string>> {
  const [m, t] = await Promise.all([
    tmdb<{ genres: { id: number; name: string }[] }>("/genre/movie/list"),
    tmdb<{ genres: { id: number; name: string }[] }>("/genre/tv/list"),
  ]);
  return new Map([...m.genres, ...t.genres].map((g) => [g.id, g.name]));
}

type Details = {
  genres?: { name: string }[];
  release_date?: string;
  first_air_date?: string;
  keywords?: { keywords?: { name: string }[]; results?: { name: string }[] };
  credits?: { cast?: { name: string }[]; crew?: { name: string; job: string }[] };
  created_by?: { name: string }[];
};

/** Genres, keywords and key people for one title. */
export async function fetchFeatures(id: number, type: MediaType): Promise<TitleFeatures> {
  const d = await tmdb<Details>(`/${type}/${id}`, { append_to_response: "keywords,credits" });
  const keywords = d.keywords?.keywords ?? d.keywords?.results ?? [];
  const directors = (d.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name);
  const creators = (d.created_by ?? []).map((c) => c.name);
  const cast = (d.credits?.cast ?? []).slice(0, 5).map((c) => c.name);
  const date = d.release_date || d.first_air_date || "";

  return {
    genres: (d.genres ?? []).map((g) => g.name),
    keywords: keywords.slice(0, 15).map((k) => k.name),
    people: [...new Set([...directors, ...creators, ...cast])],
    year: date ? date.slice(0, 4) : null,
  };
}
