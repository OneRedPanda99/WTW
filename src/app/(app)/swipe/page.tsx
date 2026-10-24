import { getDeck } from "@/app/actions";
import SwipeDeck from "./SwipeDeck";

export const metadata = { title: "Swipe · WTW?" };

export default async function SwipePage() {
  // First batch is loaded on the server so cards show up immediately.
  const initial = await getDeck("all", []).catch(() => null);
  return <SwipeDeck initial={initial} />;
}
