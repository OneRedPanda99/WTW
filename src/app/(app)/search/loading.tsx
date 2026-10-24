import { HeaderSkeleton, ListSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <div aria-hidden className="skeleton mt-4 h-11 w-full" />
      <ListSkeleton count={4} />
    </div>
  );
}
