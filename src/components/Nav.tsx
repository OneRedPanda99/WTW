"use client";

import Link from "next/link";
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
      <header className="sticky top-0 z-20 hidden border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sm:block">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <Link href="/" className="text-xl font-black tracking-tight">
            WTW<span className="text-amber-400">?</span>
          </Link>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={isActive(l.href) ? "font-semibold text-amber-400" : "text-zinc-400 hover:text-zinc-100"}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex flex-col items-center py-2 text-[11px] ${isActive(l.href) ? "text-amber-400" : "text-zinc-400"}`}
          >
            <span className="text-lg leading-none">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
