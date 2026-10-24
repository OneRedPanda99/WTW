import { HeaderSkeleton, ListSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <div aria-hidden className="skeleton mt-4 h-28 w-full rounded-xl" />
      <p className="mt-8 animate-pulse text-sm text-zinc-400">Comparing everyone&apos;s taste…</p>
      <ListSkeleton count={4} />
    </div>
  );
}
