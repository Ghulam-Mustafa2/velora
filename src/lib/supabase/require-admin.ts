import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

export async function requireAdmin() {
  const supabase = await createSupabaseAuthServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const userEmail = user.email?.trim().toLowerCase();

  if (!adminEmail || !userEmail || userEmail !== adminEmail) {
    return null;
  }

  return user;
}