import { ListSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div aria-hidden>
      <div className="flex items-end gap-4">
        <div className="skeleton aspect-[2/3] w-24" />
        <div className="space-y-2">
          <div className="skeleton h-7 w-48" />
          <div className="skeleton h-4 w-64" />
        </div>
      </div>
      <div className="skeleton mt-4 h-12 w-full max-w-3xl" />
      <ListSkeleton count={5} />
    </div>
  );
}
