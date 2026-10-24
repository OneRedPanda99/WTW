"use client";

import { useState, useTransition } from "react";
import {
  addToWatchlist,
  markNotInterested,
  rateTitle,
  removeFromWatchlist,
  removeNotInterested,
  removeRating,
} from "@/app/actions";
import { RATING_LABEL, type MediaItem, type Rating } from "@/lib/types";

type Props = {
  item: Pick<MediaItem, "id" | "media_type" | "title" | "poster_path">;
  rating?: Rating | null;
  onWatchlist?: boolean;
  notInterested?: boolean;
  compact?: boolean;
  /** Don't re-render the page after each click (for pages that update themselves, like For You). */
  quiet?: boolean;
  /** Called after you rate it or mark it "not for me" (not for watchlist changes). */
  onDone?: () => void;
};

const OPTIONS: { value: Rating; emoji: string; active: string }[] = [
  { value: -1, emoji: "👎", active: "border-red-400 bg-red-500/20 shadow-[0_0_12px_-2px] shadow-red-500/50" },
  { value: 1, emoji: "👍", active: "border-green-400 bg-green-500/20 shadow-[0_0_12px_-2px] shadow-green-500/50" },
  { value: 2, emoji: "❤️", active: "border-pink-400 bg-pink-500/20 shadow-[0_0_12px_-2px] shadow-pink-500/50" },
];

/** Rate a title you've watched, add / remove it from your watchlist, or say it's not for you. */
export default function RateButtons({
  item,
  rating = null,
  onWatchlist = false,
  notInterested = false,
  compact,
  quiet,
  onDone,
}: Props) {
  const [current, setCurrent] = useState<Rating | null>(rating);
  const [listed, setListed] = useState(onWatchlist);
  const [passed, setPassed] = useState(notInterested);
  const [burst, setBurst] = useState<{ emoji: string; id: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const opts = { quiet };

  const celebrate = (emoji: string) => setBurst((b) => ({ emoji, id: (b?.id ?? 0) + 1 }));

  function rate(value: Rating, emoji: string) {
    startTransition(async () => {
      if (current === value) {
        setCurrent(null);
        await removeRating(item.id, item.media_type, opts);
      } else {
        setCurrent(value);
        setListed(false); // rating moves it off the watchlist…
        setPassed(false); // …and out of "not for me"
        celebrate(emoji);
        await rateTitle(item, value, opts);
        onDone?.();
      }
    });
  }

  function toggleWatchlist() {
    startTransition(async () => {
      setListed(!listed);
      if (listed) await removeFromWatchlist(item.id, item.media_type, opts);
      else {
        setPassed(false);
        celebrate("🍿");
        await addToWatchlist(item, opts);
      }
    });
  }

  function togglePassed() {
    startTransition(async () => {
      setPassed(!passed);
      if (passed) await removeNotInterested(item.id, item.media_type, opts);
      else {
        setListed(false);
        celebrate("🚫");
        await markNotInterested(item, opts);
        onDone?.();
      }
    });
  }

  return (
    <div className={`relative flex flex-wrap items-center gap-1.5 ${pending ? "opacity-70" : ""}`}>
      {burst && (
        <span
          key={burst.id}
          aria-hidden
          className="animate-float-up pointer-events-none absolute -top-2 left-1/2 z-10 text-2xl"
          onAnimationEnd={() => setBurst(null)}
        >
          {burst.emoji}
        </span>
      )}
      {OPTIONS.map((o) => {
        const on = current === o.value;
        return (
          <button
            key={o.value}
            onClick={() => rate(o.value, o.emoji)}
            disabled={pending}
            title={RATING_LABEL[o.value]}
            aria-pressed={on}
            className={`rounded-lg border px-2 py-1 text-sm hover:-translate-y-0.5 ${
              on ? o.active : "border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800"
            }`}
          >
            <span key={on ? "on" : "off"} className={`inline-block ${on ? "animate-pop" : ""}`}>
              {o.emoji}
            </span>
            {!compact && <span className="ml-1">{RATING_LABEL[o.value]}</span>}
          </button>
        );
      })}
      {current === null && (
        <>
          <button
            onClick={toggleWatchlist}
            disabled={pending}
            className={`rounded-lg border px-2 py-1 text-sm hover:-translate-y-0.5 ${
              listed
                ? "border-amber-400 bg-amber-500/20 text-amber-200"
                : "border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800"
            }`}
          >
            <span key={listed ? "on" : "off"} className={`inline-block ${listed ? "animate-pop" : ""}`}>
              {listed ? "✓ On watchlist" : "+ Watchlist"}
            </span>
          </button>
          <button
            onClick={togglePassed}
            disabled={pending}
            title="Haven't seen it and don't want to. Counts a little against things like it."
            aria-pressed={passed}
            className={`rounded-lg border px-2 py-1 text-sm hover:-translate-y-0.5 ${
              passed
                ? "border-zinc-400 bg-zinc-700 text-zinc-100"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800"
            }`}
          >
            <span key={passed ? "on" : "off"} className={`inline-block ${passed ? "animate-pop" : ""}`}>
              {passed || !compact ? "🚫 Not for me" : "🚫"}
            </span>
          </button>
        </>
      )}
    </div>
  );
}
