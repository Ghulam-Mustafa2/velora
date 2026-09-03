import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseAuthBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Missing Supabase public environment variables.");
  }

  return createBrowserClient(supabaseUrl, publishableKey);
}