import Link from "next/link";
import { signOut, updateDisplayName } from "@/app/actions";
import Poster from "@/components/Poster";
import RateButtons from "@/components/RateButtons";
import { requireUser } from "@/lib/supabase/server";
import { computeTaste, type TasteFeature } from "@/lib/taste";
import type { MediaType, Rating } from "@/lib/types";

export const metadata = { title: "Profile · WTW?" };

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { data: ratings }, taste] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase
      .from("ratings")
      .select("tmdb_id, media_type, rating, title, poster_path")
      .eq("user_id", user.id)
      .order("rated_at", { ascending: false })
      .limit(60),
    computeTaste(supabase, user.id),
  ]);

  const rated = (ratings ?? []) as {
    tmdb_id: number;
    media_type: MediaType;
    rating: Rating;
    title: string;
    poster_path: string | null;
  }[];

  return (
    <div className="space-y-10">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <form action={updateDisplayName} className="flex items-end gap-2">
          <label className="block">
            <span className="text-sm text-zinc-400">Your name</span>
            <input
              name="display_name"
              defaultValue={profile?.display_name ?? ""}
              maxLength={40}
              className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400"
            />
          </label>
          <button className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">Save</button>
        </form>
        <form action={signOut}>
          <button className="text-sm text-zinc-500 hover:text-zinc-200">Sign out ({user.email})</button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-bold">Your taste</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Built from the {taste.ratedCount} title{taste.ratedCount === 1 ? "" : "s"} you&apos;ve rated. Watchlist
          items aren&apos;t included.
        </p>

        {taste.ratedCount < 5 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-zinc-400">
            Rate at least 5 things to see your taste profile.{" "}
            <Link href="/swipe" className="text-amber-300 underline">
              Start swiping →
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TasteCard title="Genres you like" items={taste.genres.filter((g) => g.score > 0).slice(0, 8)} />
            <TasteCard title="Genres you don't" items={taste.genres.filter((g) => g.score < 0).reverse().slice(0, 6)} negative />
            <TasteCard title="People you keep liking" items={taste.people.filter((p) => p.score > 0).slice(0, 8)} />
            <TasteCard title="Themes you're into" items={taste.keywords.filter((k) => k.score > 0).slice(0, 10)} />
            <TasteCard title="Favorite eras" items={taste.decades.filter((d) => d.score > 0).slice(0, 5)} />
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold">Rated</h2>
        <p className="mt-1 text-sm text-zinc-400">Tap a different rating to change it, or the same one to remove it.</p>
        {rated.length === 0 ? (
          <p className="mt-4 text-zinc-500">Nothing rated yet.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {rated.map((r) => (
              <li key={`${r.media_type}:${r.tmdb_id}`}>
                <Poster path={r.poster_path} title={r.title} size="w185" sizes="(max-width: 640px) 50vw, 180px" />
                <p className="mt-1.5 truncate text-sm font-medium">{r.title}</p>
                <div className="mt-1">
                  <RateButtons
                    compact
                    item={{ id: r.tmdb_id, media_type: r.media_type, title: r.title, poster_path: r.poster_path }}
                    rating={r.rating}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TasteCard({ title, items, negative }: { title: string; items: TasteFeature[]; negative?: boolean }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => Math.abs(i.score)));
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>
      <ul className="mt-3 space-y-1.5">
        {items.map((i) => (
          <li key={i.label} className="text-sm">
            <div className="flex justify-between gap-2">
              <span className="truncate">{i.label}</span>
              <span className="text-zinc-500">{i.count}</span>
            </div>
            <div className="mt-0.5 h-1.5 rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full ${negative ? "bg-red-400/70" : "bg-amber-400/80"}`}
                style={{ width: `${(Math.abs(i.score) / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
