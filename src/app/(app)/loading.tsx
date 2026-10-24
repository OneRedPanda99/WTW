import { HeaderSkeleton, PosterGridSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <PosterGridSkeleton />
    </div>
  );
}
