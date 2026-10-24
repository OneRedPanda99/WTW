import { HeaderSkeleton, PosterGridSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <PosterGridSkeleton count={8} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
    </div>
  );
}
