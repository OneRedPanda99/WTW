import Poster from "@/components/Poster";
import RateButtons from "@/components/RateButtons";
import type { MediaItem, Rating } from "@/lib/types";

type Props = {
  item: MediaItem;
  rating: Rating | null;
  onWatchlist: boolean;
  /** Extra line under the title, e.g. a role or "why we picked this". */
  note?: React.ReactNode;
};

/** A movie / show in a list, with rate + watchlist buttons. */
export default function TitleRow({ item, rating, onWatchlist, note }: Props) {
  return (
    <li className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <Poster path={item.poster_path} title={item.title} size="w185" className="w-20 shrink-0" sizes="80px" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {item.title}{" "}
          <span className="font-normal text-zinc-500">
            {item.year ?? "—"} · {item.media_type === "tv" ? "TV" : "Movie"}
          </span>
        </p>
        {note && <p className="mt-0.5 text-sm text-amber-300/90">{note}</p>}
        <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{item.overview}</p>
        <div className="mt-2">
          <RateButtons item={item} rating={rating} onWatchlist={onWatchlist} />
        </div>
      </div>
    </li>
  );
}
