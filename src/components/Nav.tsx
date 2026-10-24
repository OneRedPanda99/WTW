"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "For You", icon: "✨" },
  { href: "/swipe", label: "Swipe", icon: "🃏" },
  { href: "/together", label: "Together", icon: "💑" },
  { href: "/watchlist", label: "Watchlist", icon: "🍿" },
  { href: "/search", label: "Search", icon: "🔎" },
  { href: "/profile", label: "Profile", icon: "🙂" },
];

/** Top bar on desktop, bottom tab bar on phones, so Swipe is always one tap away. */
export default function Nav() {
  const path = usePathname();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <>
      <header className="sticky top-0 z-20 hidden border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sm:block">
        <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4">
          <Link href="/" className="group mr-4 py-3 text-xl font-black tracking-tight">
            WTW
            <span className="inline-block text-amber-400 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-125">
              ?
            </span>
          </Link>
          {LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`group relative rounded-md px-3 py-3 transition-colors ${
                  active ? "font-semibold text-amber-400" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                <PendingPulse>{l.label}</PendingPulse>
                <span
                  className={`absolute inset-x-3 -bottom-px h-0.5 origin-left rounded-full bg-amber-400 transition-transform duration-300 ${
                    active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50"
                  }`}
                />
              </Link>
            );
          })}
        </nav>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-zinc-800 bg-zinc-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        {LINKS.map((l) => {
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex flex-col items-center py-2 text-[11px] transition-colors ${active ? "text-amber-400" : "text-zinc-400"}`}
            >
              <span
                className={`text-lg leading-none transition-transform duration-300 ease-[var(--ease-out-back)] ${
                  active ? "-translate-y-0.5 scale-125" : ""
                }`}
              >
                {l.icon}
              </span>
              <PendingPulse>{l.label}</PendingPulse>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/** Pulses a nav label while its page is loading, so a tap always feels answered. */
function PendingPulse({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : ""}>{children}</span>;
}
