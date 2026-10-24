import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";

export default async function Home() {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, ratings, watchlist] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("ratings").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("watchlist").select("*", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  return (
    <div className="py-6">
      <h1 className="text-3xl font-black tracking-tight">Hey {profile?.display_name ?? "there"} 👋</h1>
      <p className="mt-1 text-zinc-400">
        {ratings.count ?? 0} rated · {watchlist.count ?? 0} on your watchlist
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <HomeCard href="/swipe" emoji="🃏" title="Swipe" text="Rate titles fast so WTW learns your taste. Come back any time." accent />
        <HomeCard href="/watchlist" emoji="🍿" title="Watchlist" text="Stuff you want to see. Log it once you've watched it." />
        <HomeCard href="/search" emoji="🔎" title="Search" text="Find a specific movie or show to rate or save." />
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">
        Coming next: pick a partner and get picks you&apos;ll both like.
      </div>
    </div>
  );
}

function HomeCard({ href, emoji, title, text, accent }: { href: string; emoji: string; title: string; text: string; accent?: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 ${
        accent ? "border-amber-400/50 bg-amber-400/10 hover:bg-amber-400/15" : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900"
      }`}
    >
      <div className="text-3xl">{emoji}</div>
      <h2 className="mt-3 text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-400">{text}</p>
    </Link>
  );
}
