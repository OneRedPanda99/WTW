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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-4xl font-black tracking-tight">
        WTW<span className="text-amber-400">?</span>
      </h1>
      <p className="mt-2 text-zinc-400">What to watch, figured out together.</p>

      {status === "sent" ? (
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="font-medium">Check your email.</p>
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
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 outline-none focus:border-amber-400"
            placeholder="you@example.com"
          />
          <button
            disabled={status === "sending"}
            className="w-full rounded-lg bg-amber-400 py-2.5 font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </main>
  );
}
