import Link from "next/link";
import { Suspense } from "react";
import { PosterGridSkeleton } from "@/components/Skeletons";
import { recommendFor } from "@/lib/forYou";
import { requireUser } from "@/lib/supabase/server";
import type { MediaType } from "@/lib/types";
import RecCard from "./RecCard";

export const metadata = { title: "For You · WTW?" };

const MIN_RATINGS = 5;

export default async function ForYouPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type: rawType } = await searchParams;
  const type = (rawType === "movie" || rawType === "tv" ? rawType : "all") as MediaType | "all";
  const { supabase, user } = await requireUser();

  const [{ data: profile }, ratings] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("ratings").select("*", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const ratedCount = ratings.count ?? 0;

  const tabs = [
    { value: "all", label: "All" },
    { value: "movie", label: "Movies" },
    { value: "tv", label: "TV" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">For you</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Hey {profile?.display_name ?? "there"}. Picked from the {ratedCount} things you&apos;ve rated, mostly what you
            loved.
          </p>
        </div>
        <nav className="flex gap-1 text-sm">
          {tabs.map((t) => (
            <Link
              key={t.value}
              href={t.value === "all" ? "/" : `/?type=${t.value}`}
              className={`rounded-full px-3 py-1 ${type === t.value ? "bg-zinc-100 text-zinc-950" : "bg-zinc-900 text-zinc-400"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {ratedCount < MIN_RATINGS ? (
        <div className="mt-8 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-6">
          <p className="font-semibold">Rate a few more things first</p>
          <p className="mt-1 text-sm text-zinc-300">
            WTW needs at least {MIN_RATINGS} ratings to know your taste (you have {ratedCount}). A couple of minutes of
            swiping is plenty.
          </p>
          <Link
            href="/swipe"
            className="mt-4 inline-block rounded-lg bg-amber-400 px-4 py-2 font-semibold text-zinc-950 hover:bg-amber-300"
          >
            Start swiping
          </Link>
        </div>
      ) : (
        <Suspense
          key={type}
          fallback={
            <>
              <p className="mt-6 animate-pulse text-sm text-zinc-400">Finding things you&apos;ll love…</p>
              <PosterGridSkeleton />
            </>
          }
        >
          <Recommendations userId={user.id} type={type} />
        </Suspense>
      )}
    </div>
  );
}

async function Recommendations({ userId, type }: { userId: string; type: MediaType | "all" }) {
  const { supabase } = await requireUser();
  const recs = await recommendFor(supabase, userId, type).catch(() => null);

  if (!recs) return <p className="mt-8 text-red-400">Couldn&apos;t load recommendations. Try refreshing.</p>;
  if (recs.length === 0) {
    return <p className="mt-8 text-zinc-400">Nothing new to suggest right now. Rate a few more things and check back.</p>;
  }

  return (
    <ul className="stagger mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
      {recs.map(({ item, reasons }, i) => (
        <RecCard key={`${item.media_type}:${item.id}`} item={item} reasons={reasons} index={i} />
      ))}
    </ul>
  );
}
