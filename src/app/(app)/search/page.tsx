import Poster from "@/components/Poster";
import RateButtons from "@/components/RateButtons";
import { requireUser } from "@/lib/supabase/server";
import { searchTitles } from "@/lib/tmdb";
import type { MediaItem, Rating } from "@/lib/types";

export const metadata = { title: "Search · WTW?" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  let results: MediaItem[] = [];
  let failed = false;
  const ratings = new Map<string, Rating>();
  const listed = new Set<string>();

  if (query) {
    try {
      results = await searchTitles(query);
    } catch {
      failed = true;
    }

    if (results.length) {
      const { supabase, user } = await requireUser();
      const ids = results.map((r) => r.id);
      const [r, w] = await Promise.all([
        supabase.from("ratings").select("tmdb_id, media_type, rating").eq("user_id", user.id).in("tmdb_id", ids),
        supabase.from("watchlist").select("tmdb_id, media_type").eq("user_id", user.id).in("tmdb_id", ids),
      ]);
      for (const x of r.data ?? []) ratings.set(`${x.media_type}:${x.tmdb_id}`, x.rating as Rating);
      for (const x of w.data ?? []) listed.add(`${x.media_type}:${x.tmdb_id}`);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Search</h1>
      <p className="mt-1 text-sm text-zinc-400">Rate something you&apos;ve seen, or add it to your watchlist.</p>

      <form className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Movie or show title…"
          autoFocus
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 outline-none focus:border-amber-400"
        />
        <button className="rounded-lg bg-amber-400 px-4 font-semibold text-zinc-950 hover:bg-amber-300">Search</button>
      </form>

      {failed && <p className="mt-6 text-red-400">Search failed. Check your TMDB token.</p>}
      {query && !failed && results.length === 0 && <p className="mt-6 text-zinc-400">No results for “{query}”.</p>}

      <ul className="mt-6 space-y-3">
        {results.map((item) => {
          const k = `${item.media_type}:${item.id}`;
          return (
            <li key={k} className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
              <Poster path={item.poster_path} title={item.title} size="w185" className="w-20 shrink-0" sizes="80px" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {item.title}{" "}
                  <span className="font-normal text-zinc-500">
                    {item.year ?? "—"} · {item.media_type === "tv" ? "TV" : "Movie"}
                  </span>
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{item.overview}</p>
                <div className="mt-2">
                  <RateButtons item={item} rating={ratings.get(k) ?? null} onWatchlist={listed.has(k)} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
