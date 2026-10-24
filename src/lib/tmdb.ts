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

export async function searchTitles(query: string): Promise<MediaItem[]> {
  const data = await tmdb<{ results: RawResult[] }>("/search/multi", { query, include_adult: "false" });
  return data.results
    .map((r) => toItem(r, "movie"))
    .filter((x): x is MediaItem => x !== null);
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
