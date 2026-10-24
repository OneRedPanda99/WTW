import TitleRow from "@/components/TitleRow";
import { requireUser } from "@/lib/supabase/server";
import { groupPicks, YOU, type Member } from "@/lib/together";
import type { MediaType } from "@/lib/types";
import { getUserStates } from "@/lib/userState";

export const metadata = { title: "Together · WTW?" };

type Search = { with?: string | string[]; type?: string };

export default async function TogetherPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const type = (["movie", "tv"].includes(params.type ?? "") ? params.type : "all") as MediaType | "all";
  const withIds = new Set([params.with ?? []].flat());

  const { supabase, user } = await requireUser();
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").order("display_name");
  const everyone: Member[] = (profiles ?? []).map((p) => ({ id: p.id, name: p.display_name }));
  const me = everyone.find((m) => m.id === user.id) ?? { id: user.id, name: "You" };
  const others = everyone.filter((m) => m.id !== user.id);
  const group = [{ id: me.id, name: YOU }, ...others.filter((m) => withIds.has(m.id))];

  const picks = await groupPicks(supabase, group, type);
  const { ratings, listed } = await getUserStates(supabase, user.id, picks.map((p) => p.item));

  return (
    <div>
      <h1 className="text-2xl font-bold">Watch together</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Pick who&apos;s watching. WTW finds things nobody will hate, using everyone&apos;s ratings and watchlists.
      </p>

      <form className="mt-4 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-semibold text-zinc-950">{me.name} (you)</span>
          {others.map((m) => (
            <label key={m.id} className="cursor-pointer">
              <input type="checkbox" name="with" value={m.id} defaultChecked={withIds.has(m.id)} className="peer sr-only" />
              <span className="inline-block rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-300 peer-checked:border-amber-400 peer-checked:bg-amber-400/15 peer-checked:text-amber-200 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400">
                {m.name}
              </span>
            </label>
          ))}
          {others.length === 0 && (
            <span className="text-sm text-zinc-500">
              Nobody else has signed up yet. Once they sign in, they&apos;ll show up here.
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            name="type"
            defaultValue={type}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-amber-400"
          >
            <option value="all">Movies &amp; TV</option>
            <option value="movie">Movies</option>
            <option value="tv">TV</option>
          </select>
          <button className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-300">
            Find picks
          </button>
        </div>
      </form>

      <h2 className="mt-8 text-lg font-bold">
        {group.length === 1 ? "Picks for you" : `Picks for you + ${group.slice(1).map((m) => m.name).join(" + ")}`}
      </h2>
      {picks.length === 0 ? (
        <p className="mt-3 text-zinc-500">No picks yet. Rate a few things on the Swipe page first.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {picks.map(({ item, reasons }) => {
            const k = `${item.media_type}:${item.id}`;
            return (
              <TitleRow
                key={k}
                item={item}
                rating={ratings.get(k) ?? null}
                onWatchlist={listed.has(k)}
                note={reasons.length ? reasons.join(" · ") : undefined}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
