/** Placeholder shapes shown while a page loads, matching each page's real layout. */

export function HeaderSkeleton({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div aria-hidden>
      <div className="skeleton h-8 w-48" />
      {subtitle && <div className="skeleton mt-2 h-4 w-72 max-w-full" />}
    </div>
  );
}

export function PosterGridSkeleton({ count = 10, cols = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" }) {
  return (
    <ul aria-hidden className={`stagger mt-6 grid gap-x-4 gap-y-6 ${cols}`}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} style={{ "--i": i } as React.CSSProperties}>
          <div className="skeleton aspect-[2/3] w-full" />
          <div className="skeleton mt-2 h-4 w-3/4" />
          <div className="skeleton mt-1.5 h-3 w-1/2" />
        </li>
      ))}
    </ul>
  );
}

export function ListSkeleton({ count = 6 }) {
  return (
    <ul aria-hidden className="stagger mt-6 space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          style={{ "--i": i } as React.CSSProperties}
          className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
        >
          <div className="skeleton aspect-[2/3] w-20 shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-5/6" />
            <div className="flex gap-1.5 pt-1">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="skeleton h-7 w-16" />
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DeckSkeleton() {
  return (
    <div aria-hidden className="mx-auto flex max-w-md flex-col items-center">
      <div className="flex w-full items-center justify-between">
        <div className="skeleton h-8 w-40 rounded-full" />
        <div className="skeleton h-4 w-20" />
      </div>
      <div className="skeleton mt-4 aspect-[2/3] w-full max-w-[min(340px,calc((100dvh-330px)*2/3))] min-w-[180px] rounded-2xl" />
      <div className="mt-4 flex h-28 w-full flex-col items-center gap-2">
        <div className="skeleton h-6 w-56" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-4/5" />
      </div>
      <div className="mt-5 grid w-full grid-cols-3 gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-11 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
