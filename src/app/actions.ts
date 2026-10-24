"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { computeTaste, normalizeGenre } from "@/lib/taste";
import { fetchFeatures, genreNames, popularPool, recommendationsFor } from "@/lib/tmdb";
import type { MediaItem, MediaType, Rating } from "@/lib/types";

type TitleRef = Pick<MediaItem, "id" | "media_type" | "title" | "poster_path">;
type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

const key = (id: number, type: MediaType) => `${type}:${id}`;

/** Make sure we have genres/keywords/people cached for a title we just rated. */
async function ensureFeatures(supabase: Supabase, id: number, type: MediaType) {
  const { data } = await supabase
    .from("title_cache")
    .select("tmdb_id")
    .eq("tmdb_id", id)
    .eq("media_type", type)
    .maybeSingle();
  if (data) return;
  try {
    const features = await fetchFeatures(id, type);
    await supabase.from("title_cache").upsert({ tmdb_id: id, media_type: type, data: features });
  } catch {
    // Not fatal: the profile page backfills anything missing.
  }
}

/** Re-render the current page with fresh data. Skipped with `quiet` where the page updates itself (For You, Swipe). */
type Opts = { quiet?: boolean };
function refresh(opts?: Opts) {
  if (!opts?.quiet) revalidatePath("/", "layout");
}

/** Log that you watched something and how you felt. Removes it from the watchlist. */
export async function rateTitle(item: TitleRef, rating: Rating, opts?: Opts) {
  const { supabase, user } = await requireUser();
  const match = { user_id: user.id, tmdb_id: item.id, media_type: item.media_type };

  const { error } = await supabase.from("ratings").upsert({
    ...match,
    rating,
    title: item.title,
    poster_path: item.poster_path,
    rated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  await Promise.all([
    supabase.from("watchlist").delete().match(match),
    supabase.from("skips").delete().match(match),
    supabase.from("not_interested").delete().match(match),
    ensureFeatures(supabase, item.id, item.media_type),
  ]);
  refresh(opts);
}

/** "Not for me": haven't watched it, don't want to. Counts as a mild negative in your taste. */
export async function markNotInterested(item: TitleRef, opts?: Opts) {
  const { supabase, user } = await requireUser();
  const match = { user_id: user.id, tmdb_id: item.id, media_type: item.media_type };
  const { error } = await supabase
    .from("not_interested")
    .upsert({ ...match, title: item.title, poster_path: item.poster_path });
  if (error) throw new Error(error.message);
  await Promise.all([
    supabase.from("watchlist").delete().match(match),
    supabase.from("skips").delete().match(match),
    ensureFeatures(supabase, item.id, item.media_type),
  ]);
  refresh(opts);
}

export async function removeNotInterested(id: number, type: MediaType, opts?: Opts) {
  const { supabase, user } = await requireUser();
  await supabase.from("not_interested").delete().match({ user_id: user.id, tmdb_id: id, media_type: type });
  refresh(opts);
}

/** "Haven't seen it" on the swipe deck. */
export async function skipTitle(item: TitleRef) {
  const { supabase, user } = await requireUser();
  await supabase.from("skips").upsert({ user_id: user.id, tmdb_id: item.id, media_type: item.media_type });
}

export async function addToWatchlist(item: TitleRef, opts?: Opts) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("watchlist").upsert({
    user_id: user.id,
    tmdb_id: item.id,
    media_type: item.media_type,
    title: item.title,
    poster_path: item.poster_path,
  });
  if (error) throw new Error(error.message);
  await supabase.from("not_interested").delete().match({ user_id: user.id, tmdb_id: item.id, media_type: item.media_type });
  refresh(opts);
}

export async function removeFromWatchlist(id: number, type: MediaType, opts?: Opts) {
  const { supabase, user } = await requireUser();
  await supabase.from("watchlist").delete().match({ user_id: user.id, tmdb_id: id, media_type: type });
  refresh(opts);
}

export async function removeRating(id: number, type: MediaType, opts?: Opts) {
  const { supabase, user } = await requireUser();
  await supabase.from("ratings").delete().match({ user_id: user.id, tmdb_id: id, media_type: type });
  refresh(opts);
}

/** Undo for the swipe deck: forget whatever we recorded for this title. */
export async function clearTitle(id: number, type: MediaType, opts?: Opts) {
  const { supabase, user } = await requireUser();
  const match = { user_id: user.id, tmdb_id: id, media_type: type };
  await Promise.all([
    supabase.from("ratings").delete().match(match),
    supabase.from("watchlist").delete().match(match),
    supabase.from("skips").delete().match(match),
    supabase.from("not_interested").delete().match(match),
  ]);
  refresh(opts);
}

/**
 * The next batch of swipe cards, ranked by how likely you are to have SEEN them
 * (not whether you'd like them), so you spend less time on "never heard of it".
 *
 * Signals, roughly in order of strength:
 *  - TMDB vote count: lots of votes ≈ lots of people watched it
 *  - "people who watched X also watched" for titles you've rated (liked OR disliked:
 *    both mean you watched it)
 *  - genres you've rated a lot (watching habits, not taste)
 *  - English-language titles get a small nudge
 * plus a bit of randomness so the deck doesn't feel the same every time.
 */
export async function getDeck(type: MediaType | "all", queued: string[]): Promise<MediaItem[]> {
  const { supabase, user } = await requireUser();

  const [ratings, skips, watchlist, passes, taste, genres] = await Promise.all([
    supabase.from("ratings").select("tmdb_id, media_type, rating").eq("user_id", user.id),
    supabase.from("skips").select("tmdb_id, media_type").eq("user_id", user.id),
    supabase.from("watchlist").select("tmdb_id, media_type").eq("user_id", user.id),
    supabase.from("not_interested").select("tmdb_id, media_type").eq("user_id", user.id),
    computeTaste(supabase, user.id),
    genreNames().catch(() => new Map<number, string>()),
  ]);

  const seen = new Set(queued);
  for (const r of [...(ratings.data ?? []), ...(skips.data ?? []), ...(watchlist.data ?? []), ...(passes.data ?? [])]) {
    seen.add(key(r.tmdb_id, r.media_type));
  }

  // Seed from titles you've watched; favor ones you liked, but any rating counts.
  const seeds = (ratings.data ?? [])
    .filter((r) => type === "all" || r.media_type === type)
    .map((r) => ({ ...r, sortKey: Math.random() + (r.rating > 0 ? 0.5 : 0) }))
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 5);

  const [pool, ...recLists] = await Promise.all([
    popularPool(type),
    ...seeds.map((r) => recommendationsFor(r.tmdb_id, r.media_type).catch(() => [])),
  ]);

  // How often each genre shows up in what you've watched (0..1).
  const genreShare = new Map(taste.genres.map((g) => [g.label, g.count / Math.max(1, taste.ratedCount)]));

  const recCounts = new Map<string, number>();
  for (const item of recLists.flat()) {
    const k = key(item.id, item.media_type);
    recCounts.set(k, (recCounts.get(k) ?? 0) + 1);
  }

  const candidates = new Map<string, MediaItem>();
  for (const item of [...pool, ...recLists.flat()]) {
    const k = key(item.id, item.media_type);
    if (seen.has(k) || !item.poster_path || candidates.has(k)) continue;
    if (type !== "all" && item.media_type !== type) continue;
    candidates.set(k, item);
  }

  const score = (item: MediaItem) => {
    const k = key(item.id, item.media_type);
    const fame = Math.log10(item.vote_count + 1); // 0 … ~4.6
    const fromRecs = Math.min(recCounts.get(k) ?? 0, 2) * 1.0;
    const itemGenres = new Set(item.genre_ids.flatMap((id) => normalizeGenre(genres.get(id) ?? "")));
    const habit = [...itemGenres].reduce((sum, g) => sum + (genreShare.get(g) ?? 0), 0);
    const english = item.original_language === "en" ? 0.6 : 0;
    return 1.2 * fame + fromRecs + 1.5 * Math.min(habit, 2) + english + Math.random() * 1.2;
  };

  return [...candidates.values()]
    .map((item) => ({ item, s: score(item) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 20)
    .map(({ item }) => item);
}

export async function updateDisplayName(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("display_name") ?? "").trim().slice(0, 40);
  if (name) await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
  refresh();
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}
