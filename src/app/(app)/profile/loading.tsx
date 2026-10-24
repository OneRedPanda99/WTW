import { HeaderSkeleton, PosterGridSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div aria-hidden className="space-y-10">
      <div className="flex justify-between">
        <div className="skeleton h-16 w-64" />
        <div className="skeleton h-4 w-40 self-end" />
      </div>
      <div>
        <HeaderSkeleton />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-48 rounded-xl" />
          ))}
        </div>
      </div>
      <PosterGridSkeleton count={5} />
    </div>
  );
}
