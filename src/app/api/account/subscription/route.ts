import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

export async function GET() {
  try {
    const supabase = await createSupabaseAuthServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        ok: true,
        authenticated: false,
        active: false,
        subscriptions: [],
        activePlanIds: [],
      });
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("subscriptions")
      .select(
        `
          id,
          plan_id,
          status,
          starts_at,
          expires_at
        `
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .lte("starts_at", now)
      .gt("expires_at", now);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    const subscriptions = data ?? [];

    const activePlanIds = Array.from(
      new Set(
        subscriptions
          .map((subscription) => subscription.plan_id)
          .filter(
            (planId): planId is string =>
              typeof planId === "string" && planId.length > 0
          )
      )
    );

    return NextResponse.json({
      ok: true,
      authenticated: true,
      active: activePlanIds.length > 0,
      subscriptions,
      activePlanIds,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to check subscription.",
      },
      { status: 500 }
    );
  }
}