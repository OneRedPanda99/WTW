"use client";

import { useState } from "react";
import Poster from "@/components/Poster";
import RateButtons from "@/components/RateButtons";
import type { MediaItem } from "@/lib/types";

/** One For You pick. Disappears once you rate it or say it's not for you. */
export default function RecCard({ item, reasons, index }: { item: MediaItem; reasons: string[]; index: number }) {
  const [gone, setGone] = useState(false);

  return (
    <li
      style={{ "--i": index } as React.CSSProperties}
      className={`flex flex-col transition-all duration-300 ${gone ? "pointer-events-none scale-90 opacity-0 blur-sm" : ""}`}
      onTransitionEnd={(e) => gone && e.target === e.currentTarget && (e.currentTarget.style.display = "none")}
    >
      <Poster
        path={item.poster_path}
        title={item.title}
        sizes="(max-width: 640px) 50vw, 200px"
        className="shadow-lg shadow-black/40 transition-shadow duration-300 hover:shadow-amber-500/10"
      />
      <p className="mt-2 font-semibold leading-tight">{item.title}</p>
      <p className="text-xs text-zinc-500">
        {item.year ?? "—"} · {item.media_type === "tv" ? "TV" : "Movie"} · ★ {item.vote_average.toFixed(1)}
      </p>
      {reasons.length > 0 && <p className="mt-1 line-clamp-2 text-xs text-amber-300/90">{reasons.join(" · ")}</p>}
      <div className="mt-2">
        <RateButtons compact quiet item={item} onDone={() => setGone(true)} />
      </div>
    </li>
  );
}
