"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  // The email link comes back here with the session in the URL; the client picks it up.
  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/swipe");
        router.refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) {
      setError(error.message);
      setStatus("idle");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-sm animate-fade-up flex-col justify-center px-4">
      {/* Soft marquee glow behind the logo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/4 left-1/2 -z-10 h-64 w-64 -translate-x-1/2 animate-pulse rounded-full bg-amber-500/10 blur-3xl [animation-duration:4s]"
      />
      <h1 className="text-5xl font-black tracking-tight">
        WTW<span className="inline-block animate-wiggle text-amber-400 [animation-delay:0.4s]">?</span>
      </h1>
      <p className="mt-2 text-zinc-400">What to watch, figured out together.</p>

      {status === "sent" ? (
        <div className="mt-8 animate-scale-in rounded-xl border border-amber-400/30 bg-zinc-900 p-4">
          <p className="font-medium">📬 Check your email.</p>
          <p className="mt-1 text-sm text-zinc-400">
            We sent a sign-in link to {email}. It works in any browser on this computer.
          </p>
          <button onClick={() => setStatus("idle")} className="mt-3 text-sm text-zinc-500 hover:text-zinc-300">
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-3">
          <label className="block text-sm text-zinc-400" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10"
            placeholder="you@example.com"
          />
          <button
            disabled={status === "sending"}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-2.5 font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-amber-500/30 disabled:translate-y-0 disabled:opacity-70"
          >
            {status === "sending" && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950/30 border-t-zinc-950" />
            )}
            {status === "sending" ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </main>
  );
}
