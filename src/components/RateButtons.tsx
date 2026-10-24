"use client";

import { useState, useTransition } from "react";
import { addToWatchlist, rateTitle, removeFromWatchlist, removeRating } from "@/app/actions";
import { RATING_LABEL, type MediaItem, type Rating } from "@/lib/types";

type Props = {
  item: Pick<MediaItem, "id" | "media_type" | "title" | "poster_path">;
  rating?: Rating | null;
  onWatchlist?: boolean;
  compact?: boolean;
};

const OPTIONS: { value: Rating; emoji: string; active: string }[] = [
  { value: -1, emoji: "👎", active: "border-red-400 bg-red-500/20" },
  { value: 1, emoji: "👍", active: "border-green-400 bg-green-500/20" },
  { value: 2, emoji: "❤️", active: "border-pink-400 bg-pink-500/20" },
];

/** Rate a title you've watched, or add / remove it from your watchlist. */
export default function RateButtons({ item, rating = null, onWatchlist = false, compact }: Props) {
  const [current, setCurrent] = useState<Rating | null>(rating);
  const [listed, setListed] = useState(onWatchlist);
  const [pending, startTransition] = useTransition();

  function rate(value: Rating) {
    startTransition(async () => {
      if (current === value) {
        setCurrent(null);
        await removeRating(item.id, item.media_type);
      } else {
        setCurrent(value);
        setListed(false); // rating moves it off the watchlist
        await rateTitle(item, value);
      }
    });
  }

  function toggleWatchlist() {
    startTransition(async () => {
      setListed(!listed);
      if (listed) await removeFromWatchlist(item.id, item.media_type);
      else await addToWatchlist(item);
    });
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${pending ? "opacity-60" : ""}`}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => rate(o.value)}
          disabled={pending}
          title={RATING_LABEL[o.value]}
          aria-pressed={current === o.value}
          className={`rounded-lg border px-2 py-1 text-sm ${
            current === o.value ? o.active : "border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
          }`}
        >
          {o.emoji}
          {!compact && <span className="ml-1">{RATING_LABEL[o.value]}</span>}
        </button>
      ))}
      {current === null && (
        <button
          onClick={toggleWatchlist}
          disabled={pending}
          className={`rounded-lg border px-2 py-1 text-sm ${
            listed ? "border-amber-400 bg-amber-500/20 text-amber-200" : "border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
          }`}
        >
          {listed ? "✓ On watchlist" : "+ Watchlist"}
        </button>
      )}
    </div>
  );
}
