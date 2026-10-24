import Image from "next/image";
import Link from "next/link";
import TitleRow from "@/components/TitleRow";
import { requireUser } from "@/lib/supabase/server";
import { search, type PersonResult } from "@/lib/tmdb";
import type { MediaItem } from "@/lib/types";
import { getUserStates } from "@/lib/userState";

export const metadata = { title: "Search · WTW?" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const { supabase, user } = await requireUser();

  let titles: MediaItem[] = [];
  let people: PersonResult[] = [];
  let failed = false;

  if (query) {
    try {
      ({ titles, people } = await search(query));
    } catch {
      failed = true;
    }
  }
  const { ratings, listed } = await getUserStates(supabase, user.id, titles);

  return (
    <div>
      <h1 className="text-2xl font-bold">Search</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Find a movie or show to rate or save, or an actor / director to see what they&apos;ve been in.
      </p>

      <form className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Title, actor, or director…"
          autoFocus
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 outline-none focus:border-amber-400"
        />
        <button className="rounded-lg bg-amber-400 px-4 font-semibold text-zinc-950 hover:bg-amber-300">Search</button>
      </form>

      {failed && <p className="mt-6 text-red-400">Search failed. Check your TMDB token.</p>}
      {query && !failed && titles.length === 0 && people.length === 0 && (
        <p className="mt-6 text-zinc-400">No results for “{query}”.</p>
      )}

      {people.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">People</h2>
          <ul className="stagger mt-2 flex gap-3 overflow-x-auto pb-2">
            {people.map((p, i) => (
              <li key={p.id} className="w-28 shrink-0" style={{ "--i": i } as React.CSSProperties}>
                <Link href={`/person/${p.id}`} className="group block">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800">
                    {p.profile_path && (
                      <Image
                        src={`https://image.tmdb.org/t/p/w185${p.profile_path}`}
                        alt={p.name}
                        fill
                        sizes="112px"
                        className="object-cover transition group-hover:scale-105"
                      />
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium leading-tight group-hover:text-amber-300">{p.name}</p>
                  <p className="text-xs text-zinc-500">{p.known_for_department}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {titles.length > 0 && (
        <section className="mt-6">
          {people.length > 0 && (
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Movies &amp; shows</h2>
          )}
          <ul className="stagger mt-2 space-y-3">
            {titles.map((item, i) => {
              const k = `${item.media_type}:${item.id}`;
              return (
                <TitleRow key={k} index={i} item={item} rating={ratings.get(k) ?? null} onWatchlist={listed.has(k)} />
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
