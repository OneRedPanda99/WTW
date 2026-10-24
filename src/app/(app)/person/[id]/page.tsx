import Image from "next/image";
import { notFound } from "next/navigation";
import TitleRow from "@/components/TitleRow";
import { requireUser } from "@/lib/supabase/server";
import { personCredits } from "@/lib/tmdb";
import { getUserStates } from "@/lib/userState";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> };

export async function generateMetadata({ params }: Pick<Params, "params">) {
  const person = await personCredits(Number((await params).id)).catch(() => null);
  return { title: `${person?.name ?? "Person"} · WTW?` };
}

export default async function PersonPage({ params, searchParams }: Params) {
  const { id } = await params;
  const { type = "all" } = await searchParams;
  const personId = Number(id);
  if (!Number.isInteger(personId)) notFound();

  const { supabase, user } = await requireUser();
  const person = await personCredits(personId).catch(() => null);
  if (!person) notFound();

  const credits = person.credits.filter((c) => type === "all" || c.media_type === type);
  const { ratings, listed } = await getUserStates(supabase, user.id, credits);
  const seenCount = credits.filter((c) => ratings.has(`${c.media_type}:${c.id}`)).length;

  const tabs = [
    { value: "all", label: "All" },
    { value: "movie", label: "Movies" },
    { value: "tv", label: "TV" },
  ];

  return (
    <div>
      <div className="flex items-end gap-4">
        <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
          {person.profile_path && (
            <Image
              src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
              alt={person.name}
              fill
              sizes="96px"
              className="object-cover"
            />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{person.name}</h1>
          <p className="text-sm text-zinc-400">
            {person.known_for_department} · {person.credits.length} titles · you&apos;ve rated {seenCount}
          </p>
        </div>
      </div>
      {person.biography && <p className="mt-4 line-clamp-3 max-w-3xl text-sm text-zinc-400">{person.biography}</p>}

      <nav className="mt-5 flex gap-1 text-sm">
        {tabs.map((t) => (
          <a
            key={t.value}
            href={`?type=${t.value}`}
            className={`rounded-full px-3 py-1 ${type === t.value ? "bg-zinc-100 text-zinc-950" : "bg-zinc-900 text-zinc-400"}`}
          >
            {t.label}
          </a>
        ))}
      </nav>

      <ul className="stagger mt-4 space-y-3">
        {credits.slice(0, 60).map((c, i) => {
          const k = `${c.media_type}:${c.id}`;
          return (
            <TitleRow
              key={k}
              index={i}
              item={c}
              rating={ratings.get(k) ?? null}
              onWatchlist={listed.has(k)}
              note={c.role}
            />
          );
        })}
      </ul>
    </div>
  );
}
