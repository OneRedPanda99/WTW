import Link from "next/link";
import Poster from "@/components/Poster";
import { requireUser } from "@/lib/supabase/server";
import type { MediaType } from "@/lib/types";
import WatchlistActions from "./WatchlistActions";

export const metadata = { title: "Watchlist · WTW?" };

export default async function WatchlistPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("watchlist")
    .select("tmdb_id, media_type, title, poster_path, added_at")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  const items = (data ?? []) as {
    tmdb_id: number;
    media_type: MediaType;
    title: string;
    poster_path: string | null;
  }[];

  return (
    <div>
      <h1 className="text-2xl font-bold">Watchlist</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Things you want to watch. They don&apos;t count toward your taste until you watch one and say how it was.
      </p>

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-800 p-8 text-center text-zinc-400">
          Nothing here yet. Tap <span className="text-amber-300">+ Watchlist</span> while{" "}
          <Link href="/swipe" className="underline">
            swiping
          </Link>{" "}
          or{" "}
          <Link href="/search" className="underline">
            searching
          </Link>
          .
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((i) => (
            <li key={`${i.media_type}:${i.tmdb_id}`} className="flex flex-col">
              <Poster path={i.poster_path} title={i.title} sizes="(max-width: 640px) 50vw, 240px" />
              <p className="mt-2 font-medium leading-tight">{i.title}</p>
              <p className="text-xs text-zinc-500">{i.media_type === "tv" ? "TV" : "Movie"}</p>
              <WatchlistActions
                item={{ id: i.tmdb_id, media_type: i.media_type, title: i.title, poster_path: i.poster_path }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
