"use client";

import { useState, useTransition } from "react";
import { rateTitle, removeFromWatchlist } from "@/app/actions";
import type { MediaItem, Rating } from "@/lib/types";

type Props = { item: Pick<MediaItem, "id" | "media_type" | "title" | "poster_path"> };

/** "Watched it" → how was it? Logging a rating moves the title off the watchlist and into your taste. */
export default function WatchlistActions({ item }: Props) {
  const [logging, setLogging] = useState(false);
  const [pending, startTransition] = useTransition();

  const log = (rating: Rating) => startTransition(() => rateTitle(item, rating));
  const remove = () => startTransition(() => removeFromWatchlist(item.id, item.media_type));

  if (logging) {
    return (
      <div className={`mt-2 animate-scale-in ${pending ? "animate-pulse" : ""}`}>
        <p className="text-xs text-zinc-400">How was it?</p>
        <div className="stagger mt-1 grid grid-cols-3 gap-1">
          {(
            [
              [-1, "👎", "Didn't like", "hover:bg-red-500/30"],
              [1, "👍", "Liked", "hover:bg-green-500/30"],
              [2, "❤️", "Loved", "hover:bg-pink-500/30"],
            ] as const
          ).map(([value, emoji, label, hover], i) => (
            <button
              key={value}
              disabled={pending}
              onClick={() => log(value)}
              title={label}
              style={{ "--i": i } as React.CSSProperties}
              className={`rounded-md bg-zinc-800 py-1.5 text-sm hover:-translate-y-0.5 ${hover}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <button onClick={() => setLogging(false)} className="mt-1 text-xs text-zinc-500 hover:text-zinc-300">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className={`mt-2 flex gap-1 ${pending ? "animate-pulse" : ""}`}>
      <button
        onClick={() => setLogging(true)}
        className="flex-1 rounded-md bg-amber-400 py-1.5 text-sm font-semibold text-zinc-950 shadow-md shadow-amber-500/10 hover:bg-amber-300 hover:shadow-amber-500/30"
      >
        Watched it
      </button>
      <button
        onClick={remove}
        disabled={pending}
        className="rounded-md bg-zinc-800 px-2 text-sm text-zinc-400 hover:rotate-90 hover:bg-zinc-700 hover:text-zinc-100"
        title="Remove from watchlist"
      >
        ✕
      </button>
    </div>
  );
}
