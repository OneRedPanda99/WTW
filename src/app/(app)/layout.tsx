import Nav from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 pt-4 pb-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-24 text-center text-xs text-zinc-600 sm:pb-6">
        Movie and TV data from{" "}
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="underline hover:text-zinc-400">
          TMDB
        </a>
        . This product uses the TMDB API but is not endorsed or certified by TMDB.
      </footer>
    </>
  );
}
