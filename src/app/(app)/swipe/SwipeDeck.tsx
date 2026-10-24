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
  const [flying, setFlying] = useState<Flight[]>([]);
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
      setFlying((f) => [...f, { item: current, choice, fromX: dragX, id: `${current.media_type}:${current.id}:${Date.now()}` }]);
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
    [current, queue, history, filter, loadMore, dragX],
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
  // Stamp fades in as you drag, fully visible at the swipe threshold.
  const hintOpacity = Math.min(1, Math.max(0, (Math.abs(dragX) - 30) / (SWIPE_THRESHOLD - 30)));

  return (
    <div className="mx-auto flex max-w-md flex-col items-center">
      <div className="flex w-full items-center justify-between">
        <div className="relative flex gap-1 rounded-full bg-zinc-900 p-1 text-sm">
          {(["all", "movie", "tv"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => changeFilter(f)}
              className={`rounded-full px-3 py-1 ${
                filter === f ? "bg-zinc-100 text-zinc-950 shadow" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {f === "all" ? "All" : f === "movie" ? "Movies" : "TV"}
            </button>
          ))}
        </div>
        <span className="text-sm text-zinc-500">
          <span key={count} className={`inline-block tabular-nums ${count ? "animate-pop text-zinc-300" : ""}`}>
            {count}
          </span>{" "}
          this session
        </span>
      </div>

      <div className="relative mt-4 w-full max-w-[min(340px,calc((100dvh-330px)*2/3))] min-w-[180px] select-none">
        {loading ? (
          <div className="skeleton aspect-[2/3] w-full rounded-2xl" />
        ) : !current ? (
          <div className="flex aspect-[2/3] w-full animate-fade-in items-center justify-center rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-zinc-500">
            {error || "No more titles right now."}
          </div>
        ) : (
          <>
            {queue[1] && (
              <div className="absolute inset-0 scale-95 opacity-50 transition-all duration-300">
                <Poster
                  path={queue[1].poster_path}
                  title={queue[1].title}
                  size="w500"
                  sizes="340px"
                  hoverZoom={false}
                  className="rounded-2xl"
                />
              </div>
            )}
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
                transition: dragging ? "none" : "transform 0.35s var(--ease-out-back)",
              }}
              className="relative cursor-grab touch-pan-y active:cursor-grabbing"
            >
              <div key={`${current.media_type}:${current.id}`} className="animate-scale-in">
                <Poster
                  path={current.poster_path}
                  title={current.title}
                  size="w500"
                  priority
                  sizes="340px"
                  hoverZoom={false}
                  className="rounded-2xl shadow-2xl shadow-black/60"
                />
              </div>
              {hint && (
                <div
                  style={{ opacity: hintOpacity }}
                  className={`absolute top-6 rounded-lg border-4 bg-black/30 px-3 py-1 text-2xl font-black uppercase backdrop-blur-sm ${
                    dragX > 0 ? "left-6 -rotate-12 border-green-400 text-green-400" : "right-6 rotate-12 border-red-400 text-red-400"
                  }`}
                >
                  {hint}
                </div>
              )}
            </div>
          </>
        )}
        {flying.map((f) => (
          <FlyingCard key={f.id} flight={f} onDone={() => setFlying((all) => all.filter((x) => x.id !== f.id))} />
        ))}
      </div>

      {/* Fixed height so the buttons below never move between cards. */}
      <div className="mt-4 h-28 w-full overflow-hidden text-center">
        {current && !loading && (
          <div key={`${current.media_type}:${current.id}`} className="animate-fade-in">
            <h2 className="line-clamp-1 text-xl font-bold">
              {current.title}{" "}
              <span className="font-normal text-zinc-500">
                {current.year} · {current.media_type === "tv" ? "TV" : "Movie"}
              </span>
            </h2>
            <p className="mt-1 line-clamp-3 text-sm text-zinc-400">{current.overview}</p>
          </div>
        )}
      </div>

      <div className="mt-5 grid w-full grid-cols-3 gap-2">
        <DeckButton
          onClick={() => choose(-1)}
          disabled={!current}
          className="border-red-500/40 text-red-300 hover:border-red-400 hover:bg-red-500/10 hover:shadow-red-500/20"
        >
          👎 Didn&apos;t like
        </DeckButton>
        <DeckButton
          onClick={() => choose(2)}
          disabled={!current}
          className="border-pink-500/40 text-pink-300 hover:border-pink-400 hover:bg-pink-500/10 hover:shadow-pink-500/20"
        >
          ❤️ Loved
        </DeckButton>
        <DeckButton
          onClick={() => choose(1)}
          disabled={!current}
          className="border-green-500/40 text-green-300 hover:border-green-400 hover:bg-green-500/10 hover:shadow-green-500/20"
        >
          👍 Liked
        </DeckButton>
        <DeckButton onClick={() => choose("skip")} disabled={!current} className="hover:border-zinc-500">
          Haven&apos;t seen
        </DeckButton>
        <DeckButton onClick={() => choose("pass")} disabled={!current} className="text-zinc-400 hover:border-zinc-500 hover:text-zinc-200">
          🚫 Not for me
        </DeckButton>
        <DeckButton
          onClick={() => choose("watchlist")}
          disabled={!current}
          className="border-amber-500/40 text-amber-300 hover:border-amber-400 hover:bg-amber-500/10 hover:shadow-amber-500/20"
        >
          + Watchlist
        </DeckButton>
      </div>

      <div className="mt-3 flex min-h-5 w-full items-center justify-between gap-3 text-sm text-zinc-500">
        <span className="truncate">
          {history[0] && (
            <span key={history.length + history[0].item.id} className="inline-block animate-fade-in">
              {history[0].item.title}: {CHOICE_TEXT[String(history[0].choice)]}
            </span>
          )}
        </span>
        <button
          onClick={undo}
          disabled={history.length === 0}
          className="group shrink-0 hover:text-zinc-200 disabled:opacity-30"
        >
          <span className="inline-block transition-transform duration-300 group-hover:-rotate-45">↩</span> Undo
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
      className={`rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-3 text-sm font-medium shadow-lg shadow-transparent hover:-translate-y-0.5 hover:bg-zinc-800 disabled:translate-y-0 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

type Flight = { item: MediaItem; choice: Choice; fromX: number; id: string };

// Where each choice sends the card, and the emoji that pops over it.
const FLIGHT: Record<string, { to: string; emoji: string }> = {
  "1": { to: "translate(140%, -10%) rotate(22deg)", emoji: "👍" },
  "-1": { to: "translate(-140%, -10%) rotate(-22deg)", emoji: "👎" },
  "2": { to: "translate(0, -130%) rotate(-4deg) scale(1.05)", emoji: "❤️" },
  watchlist: { to: "translate(110%, -90%) rotate(14deg) scale(0.5)", emoji: "🍿" },
  pass: { to: "translate(-120%, 30%) rotate(-12deg) scale(0.85)", emoji: "🚫" },
  skip: { to: "translate(0, 35%) scale(0.85)", emoji: "🤷" },
};

/** The card you just answered, flying off in the direction of your choice. */
function FlyingCard({ flight, onDone }: { flight: Flight; onDone: () => void }) {
  const [go, setGo] = useState(false);
  const { to, emoji } = FLIGHT[String(flight.choice)];
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    // Wait a frame so the start position paints before the transition kicks in.
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    const fallback = setTimeout(() => done.current(), 900); // in case transitionend never fires
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        onTransitionEnd={(e) => e.propertyName === "transform" && done.current()}
        style={{
          transform: go ? to : `translateX(${flight.fromX}px) rotate(${flight.fromX / 20}deg)`,
          opacity: go ? 0 : 1,
          transition: "transform 0.5s cubic-bezier(0.4, 0, 0.6, 1), opacity 0.5s ease-in",
        }}
      >
        <Poster
          path={flight.item.poster_path}
          title={flight.item.title}
          size="w500"
          sizes="340px"
          hoverZoom={false}
          fade={false}
          className="rounded-2xl shadow-2xl shadow-black/60"
        />
      </div>
      <span className="animate-float-up absolute top-1/3 left-1/2 text-6xl drop-shadow-lg">{emoji}</span>
    </div>
  );
}
