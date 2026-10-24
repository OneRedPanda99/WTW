"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  path: string | null;
  title: string;
  size?: "w185" | "w342" | "w500";
  className?: string;
  priority?: boolean;
  sizes?: string;
  /** Zoom in a little on hover (for posters you can act on). */
  hoverZoom?: boolean;
  /** Fade in once loaded. Off for copies of a poster that's already on screen. */
  fade?: boolean;
};

/** A poster that shimmers while loading, then fades in. */
export default function Poster({
  path,
  title,
  size = "w342",
  className = "",
  priority,
  sizes = "200px",
  hoverZoom = true,
  fade = true,
}: Props) {
  const [loadedState, setLoaded] = useState(false);
  const loaded = loadedState || !fade;

  return (
    <div
      className={`group/poster relative aspect-[2/3] overflow-hidden rounded-lg ${loaded ? "bg-zinc-800" : "skeleton"} ${className}`}
    >
      {path ? (
        <Image
          src={`https://image.tmdb.org/t/p/${size}${path}`}
          alt={title}
          fill
          sizes={sizes}
          priority={priority}
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={`object-cover transition duration-500 ease-out ${loaded ? "opacity-100" : "opacity-0"} ${
            hoverZoom ? "group-hover/poster:scale-[1.04]" : ""
          }`}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-center text-sm text-zinc-500">{title}</div>
      )}
    </div>
  );
}
