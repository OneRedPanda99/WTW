import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaItem, Rating } from "./types";

/** Your rating and watchlist status for each of these titles, keyed "type:id". */
export async function getUserStates(supabase: SupabaseClient, userId: string, items: Pick<MediaItem, "id">[]) {
  const ratings = new Map<string, Rating>();
  const listed = new Set<string>();
  if (items.length === 0) return { ratings, listed };

  const ids = [...new Set(items.map((i) => i.id))];
  const [r, w] = await Promise.all([
    supabase.from("ratings").select("tmdb_id, media_type, rating").eq("user_id", userId).in("tmdb_id", ids),
    supabase.from("watchlist").select("tmdb_id, media_type").eq("user_id", userId).in("tmdb_id", ids),
  ]);
  for (const x of r.data ?? []) ratings.set(`${x.media_type}:${x.tmdb_id}`, x.rating as Rating);
  for (const x of w.data ?? []) listed.add(`${x.media_type}:${x.tmdb_id}`);
  return { ratings, listed };
}
