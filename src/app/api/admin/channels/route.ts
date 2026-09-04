import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/require-admin";

type AccessType = "free" | "paid";

function normalizeAccessType(value: unknown): AccessType {
  return value === "paid" ? "paid" : "free";
}

export async function GET() {
  try {
    const user = await requireAdmin();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      count: data.length,
      channels: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      name?: string;
      category?: string;
      description?: string;
      youtubeChannelId?: string | null;
      youtubeHandle?: string | null;
      officialEmbedUrl?: string | null;
      logoLocal?: string | null;
      comingSoon?: boolean;
      accessType?: AccessType;
      requiredPlanId?: string | null;
    };

    const name = body.name?.trim();
    const category = body.category?.trim();
    const description = body.description?.trim() ?? "";
    const accessType = normalizeAccessType(body.accessType);

    const requiredPlanId =
      accessType === "paid"
        ? body.requiredPlanId?.trim() || null
        : null;

    if (!name || !category) {
      return NextResponse.json(
        {
          ok: false,
          error: "Name and category are required.",
        },
        { status: 400 }
      );
    }

    if (accessType === "paid" && !requiredPlanId) {
      return NextResponse.json(
        {
          ok: false,
          error: "A subscription plan is required for paid channels.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    if (requiredPlanId) {
      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("id, is_active")
        .eq("id", requiredPlanId)
        .maybeSingle();

      if (planError) {
        return NextResponse.json(
          {
            ok: false,
            error: planError.message,
          },
          { status: 500 }
        );
      }

      if (!plan || !plan.is_active) {
        return NextResponse.json(
          {
            ok: false,
            error: "The selected subscription plan is unavailable.",
          },
          { status: 400 }
        );
      }
    }

    const { data: lastChannel, error: sortError } = await supabase
      .from("channels")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sortError) {
      return NextResponse.json(
        {
          ok: false,
          error: sortError.message,
        },
        { status: 500 }
      );
    }

    const nextSortOrder =
      typeof lastChannel?.sort_order === "number"
        ? lastChannel.sort_order + 1
        : 1;

    const baseKey = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!baseKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unable to generate a valid channel key.",
        },
        { status: 400 }
      );
    }

    const { data: existingChannel, error: existingChannelError } =
      await supabase
        .from("channels")
        .select("id")
        .eq("key", baseKey)
        .maybeSingle();

    if (existingChannelError) {
      return NextResponse.json(
        {
          ok: false,
          error: existingChannelError.message,
        },
        { status: 500 }
      );
    }

    const key = existingChannel
      ? `${baseKey}-${Date.now()}`
      : baseKey;

    const { data, error } = await supabase
      .from("channels")
      .insert({
        key,
        name,
        category,
        description,
        youtube_channel_id:
          body.youtubeChannelId?.trim() || null,
        youtube_handle:
          body.youtubeHandle?.trim() || null,
        official_embed_url:
          body.officialEmbedUrl?.trim() || null,
        logo_local:
          body.logoLocal?.trim() || null,
        coming_soon: body.comingSoon ?? false,
        is_active: true,
        sort_order: nextSortOrder,

        // Phase 2 access control
        access_type: accessType,
        required_plan_id: requiredPlanId,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        channel: data,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAdmin();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      id?: string;
      name?: string;
      category?: string;
      description?: string;
      youtubeChannelId?: string | null;
      youtubeHandle?: string | null;
      officialEmbedUrl?: string | null;
      logoLocal?: string | null;
      comingSoon?: boolean;
      isActive?: boolean;
      sortOrder?: number;

      // Phase 2 access control
      accessType?: AccessType;
      requiredPlanId?: string | null;
    };

    if (!body.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Channel id is required.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      updates.name = body.name.trim();
    }

    if (typeof body.category === "string") {
      updates.category = body.category.trim();
    }

    if (typeof body.description === "string") {
      updates.description = body.description.trim();
    }

    if ("youtubeChannelId" in body) {
      updates.youtube_channel_id =
        body.youtubeChannelId?.trim() || null;
    }

    if ("youtubeHandle" in body) {
      updates.youtube_handle =
        body.youtubeHandle?.trim() || null;
    }

    if ("officialEmbedUrl" in body) {
      updates.official_embed_url =
        body.officialEmbedUrl?.trim() || null;
    }

    if ("logoLocal" in body) {
      updates.logo_local =
        body.logoLocal?.trim() || null;
    }

    if (typeof body.comingSoon === "boolean") {
      updates.coming_soon = body.comingSoon;
    }

    if (typeof body.isActive === "boolean") {
      updates.is_active = body.isActive;
    }

    if (
      typeof body.sortOrder === "number" &&
      Number.isFinite(body.sortOrder)
    ) {
      updates.sort_order = body.sortOrder;
    }

    /*
     * Access control needs slightly special handling.
     *
     * The edit form normally sends both accessType and requiredPlanId
     * together. Other PATCH operations, such as archive/restore or
     * category rename, do not send these fields and therefore leave the
     * access configuration untouched.
     */
    if ("accessType" in body) {
      const accessType = normalizeAccessType(body.accessType);

      updates.access_type = accessType;

      if (accessType === "free") {
        updates.required_plan_id = null;
      } else {
        const requiredPlanId =
          body.requiredPlanId?.trim() || null;

        if (!requiredPlanId) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "A subscription plan is required for paid channels.",
            },
            { status: 400 }
          );
        }

        const { data: plan, error: planError } = await supabase
          .from("plans")
          .select("id, is_active")
          .eq("id", requiredPlanId)
          .maybeSingle();

        if (planError) {
          return NextResponse.json(
            {
              ok: false,
              error: planError.message,
            },
            { status: 500 }
          );
        }

        if (!plan || !plan.is_active) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "The selected subscription plan is unavailable.",
            },
            { status: 400 }
          );
        }

        updates.required_plan_id = requiredPlanId;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No valid fields were provided.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("channels")
      .update(updates)
      .eq("id", body.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      channel: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}