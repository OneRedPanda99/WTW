"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Poster from "@/components/Poster";
import { addToWatchlist, clearTitle, getDeck, markNotInterested, rateTitle, skipTitle } from "@/app/actions";
import type { MediaItem, MediaType, Rating } from "@/lib/types";

type Choice = Rating | "skip" | "watchlist" | "pass";
type Filter = MediaType | "all";

const CHOICE_TEXT: Record<string, string> = {
  "-1": "Didn't like",
  "1": "Liked",
  "2": "Loved",
  skip: "Haven't seen",
  watchlist: "Added to watchlist",
  pass: "Not for me",
};

// The deck updates itself, so saves don't need to re-render the page.
const QUIET = { quiet: true };

const SWIPE_THRESHOLD = 110;

/**
 * Endless swipe deck. Leave and come back any time: it just picks up with new
 * titles you haven't answered yet.
 */
export default function SwipeDeck({ initial }: { initial: MediaItem[] | null }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [queue, setQueue] = useState<MediaItem[]>(initial ?? []);
  const [history, setHistory] = useState<{ item: MediaItem; choice: Choice }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initial ? "" : "Couldn't load titles. Check your TMDB token and try again.");
  const [dragX, setDragX] = useState(0);
  const [count, setCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<number | null>(null);
  const fetching = useRef(false);
  const request = useRef(0);

  /** Replace the deck (new filter) or append to it (topping up). Stale responses are dropped. */
  const loadMore = useCallback(async (f: Filter, exclude: MediaItem[], replace = false) => {
    if (!replace && fetching.current) return;
    fetching.current = true;
    const id = ++request.current;
    try {
      const more = await getDeck(f, exclude.map((i) => `${i.media_type}:${i.id}`));
      if (id !== request.current) return;
      setError("");
      setQueue((q) => (replace ? more : [...q, ...more]));
    } catch {
      if (id === request.current) setError("Couldn't load titles. Check your TMDB token and try again.");
    } finally {
      if (id === request.current) {
        fetching.current = false;
        setLoading(false);
      }
    }
  }, []);

  function changeFilter(f: Filter) {
    if (f === filter) return;
    setFilter(f);
    setLoading(true);
    setQueue([]);
    loadMore(f, history.map((h) => h.item), true);
  }

  const current = queue[0];

  const choose = useCallback(
    (choice: Choice) => {
      if (!current) return;
      const remaining = queue.slice(1);
      setQueue(remaining);
      setHistory((h) => [{ item: current, choice }, ...h].slice(0, 20));
      setDragX(0);
      setCount((c) => c + 1);

      // Top up before the deck runs dry. Exclude what was just answered in case the save hasn't landed yet.
      if (remaining.length < 6) loadMore(filter, [...remaining, current, ...history.map((h) => h.item)]);

      const save =
        choice === "skip"
          ? skipTitle(current)
          : choice === "watchlist"
            ? addToWatchlist(current, QUIET)
            : choice === "pass"
              ? markNotInterested(current, QUIET)
              : rateTitle(current, choice, QUIET);
      save.catch(() => setError(`Couldn't save "${current.title}". Try undo and again.`));
    },
    [current, queue, history, filter, loadMore],
  );

  const undo = useCallback(() => {
    const [last, ...rest] = history;
    if (!last) return;
    setHistory(rest);
    setQueue((q) => [last.item, ...q]);
    setCount((c) => Math.max(0, c - 1));
    clearTitle(last.item.id, last.item.media_type, QUIET).catch(() => {});
  }, [history]);

  // Keyboard: ← didn't like, → liked, ↑ loved, ↓ haven't seen, W watchlist, Z undo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      const map: Record<string, Choice> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: 2,
        ArrowDown: "skip",
        w: "watchlist",
        x: "pass",
      };
      if (e.key in map) {
        e.preventDefault();
        choose(map[e.key]);
      } else if (e.key === "z" || e.key === "Backspace") {
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, undo]);

  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStart.current !== null) setDragX(e.clientX - dragStart.current);
  }
  function onPointerUp() {
    if (dragStart.current === null) return;
    dragStart.current = null;
    setDragging(false);
    if (dragX > SWIPE_THRESHOLD) choose(1);
    else if (dragX < -SWIPE_THRESHOLD) choose(-1);
    else setDragX(0);
  }

  const hint = dragX > 40 ? "Liked" : dragX < -40 ? "Didn't like" : null;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center">
      <div className="flex w-full items-center justify-between">
        <div className="flex gap-1 rounded-full bg-zinc-900 p-1 text-sm">
          {(["all", "movie", "tv"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => changeFilter(f)}
              className={`rounded-full px-3 py-1 ${filter === f ? "bg-zinc-100 text-zinc-950" : "text-zinc-400"}`}
            >
              {f === "all" ? "All" : f === "movie" ? "Movies" : "TV"}
            </button>
          ))}
        </div>
        <span className="text-sm text-zinc-500">{count} this session</span>
      </div>

      <div className="relative mt-4 w-full max-w-[min(340px,calc((100dvh-330px)*2/3))] min-w-[180px] select-none">
        {loading || !current ? (
          <div className="flex aspect-[2/3] w-full items-center justify-center rounded-2xl border border-dashed border-zinc-800 text-zinc-500">
            {loading ? "Loading titles…" : error || "No more titles right now."}
          </div>
        ) : (
          <>
            {queue[1] && (
              <div className="absolute inset-0 scale-95 opacity-60">
                <Poster path={queue[1].poster_path} title={queue[1].title} size="w500" sizes="340px" className="rounded-2xl" />
              </div>
            )}
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
                transition: dragging ? "none" : "transform 0.2s",
              }}
              className="relative cursor-grab touch-pan-y active:cursor-grabbing"
            >
              <Poster
                path={current.poster_path}
                title={current.title}
                size="w500"
                priority
                sizes="340px"
                className="rounded-2xl shadow-2xl shadow-black/60"
              />
              {hint && (
                <div
                  className={`absolute top-6 rounded-lg border-4 px-3 py-1 text-2xl font-black uppercase ${
                    dragX > 0 ? "left-6 -rotate-12 border-green-400 text-green-400" : "right-6 rotate-12 border-red-400 text-red-400"
                  }`}
                >
                  {hint}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Fixed height so the buttons below never move between cards. */}
      <div className="mt-4 h-28 w-full overflow-hidden text-center">
        {current && !loading && (
          <>
            <h2 className="line-clamp-1 text-xl font-bold">
              {current.title}{" "}
              <span className="font-normal text-zinc-500">
                {current.year} · {current.media_type === "tv" ? "TV" : "Movie"}
              </span>
            </h2>
            <p className="mt-1 line-clamp-3 text-sm text-zinc-400">{current.overview}</p>
          </>
        )}
      </div>

      <div className="mt-5 grid w-full grid-cols-3 gap-2">
        <DeckButton onClick={() => choose(-1)} disabled={!current} className="border-red-500/40 text-red-300">
          👎 Didn&apos;t like
        </DeckButton>
        <DeckButton onClick={() => choose(2)} disabled={!current} className="border-pink-500/40 text-pink-300">
          ❤️ Loved
        </DeckButton>
        <DeckButton onClick={() => choose(1)} disabled={!current} className="border-green-500/40 text-green-300">
          👍 Liked
        </DeckButton>
        <DeckButton onClick={() => choose("skip")} disabled={!current}>
          Haven&apos;t seen
        </DeckButton>
        <DeckButton onClick={() => choose("pass")} disabled={!current} className="text-zinc-400">
          🚫 Not for me
        </DeckButton>
        <DeckButton onClick={() => choose("watchlist")} disabled={!current} className="border-amber-500/40 text-amber-300">
          + Watchlist
        </DeckButton>
      </div>

      <div className="mt-3 flex min-h-5 w-full items-center justify-between gap-3 text-sm text-zinc-500">
        <span className="truncate">
          {history[0] && `${history[0].item.title}: ${CHOICE_TEXT[String(history[0].choice)]}`}
        </span>
        <button onClick={undo} disabled={history.length === 0} className="shrink-0 hover:text-zinc-200 disabled:opacity-30">
          ↩ Undo
        </button>
      </div>
      {error && current && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <p className="mt-6 hidden text-center text-xs text-zinc-600 sm:block">
        Keys: ← didn&apos;t like · → liked · ↑ loved · ↓ haven&apos;t seen · X not for me · W watchlist · Z undo
      </p>
      <p className="mt-2 text-center text-xs text-zinc-600">
        Ratings shape your taste, and &ldquo;not for me&rdquo; counts a little against similar things. Watchlist and
        &ldquo;haven&apos;t seen&rdquo; don&apos;t count.
      </p>
    </div>
  );
}

function DeckButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-3 text-sm font-medium hover:bg-zinc-800 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
