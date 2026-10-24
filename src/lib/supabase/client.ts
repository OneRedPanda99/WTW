import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // "implicit" puts the session in the link itself, so the sign-in email works
    // even when it opens in a different browser than the one that requested it.
    { auth: { flowType: "implicit" } },
  );
}
