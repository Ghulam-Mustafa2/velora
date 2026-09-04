import { redirect } from "next/navigation";

import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/supabase/require-admin";

export default async function ProtectedAdminLayout({

  children,

}: Readonly<{

  children: ReactNode;

}>) {

  const user = await requireAdmin();

  if (!user) {

    redirect("/admin/login");

  }

  return children;

}