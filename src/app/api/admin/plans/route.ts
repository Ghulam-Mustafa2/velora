import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/supabase/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PlanRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | string;
  duration_days: number;
  is_active: boolean;
  sort_order: number;
};

function mapPlan(row: PlanRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    price: Number(row.price ?? 0),
    duration_days: Number(row.duration_days ?? 30),
    isActive: row.is_active,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("plans")
      .select(
        `
          id,
          name,
          slug,
          description,
          price,
          duration_days,
          is_active,
          sort_order
        `
      )
      .order("sort_order", { ascending: true })
      .order("price", { ascending: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      plans: ((data ?? []) as PlanRow[]).map(mapPlan),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load subscription plans.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      description?: string;
      price?: number;
      durationDays?: number;
      isActive?: boolean;
      sortOrder?: number;
    };

    const name = body.name?.trim();
    const slug = createSlug(body.slug?.trim() || name || "");
    const description = body.description?.trim() || "";
    const price = Number(body.price);
    const durationDays = Number(body.durationDays);
    const sortOrder = Number(body.sortOrder ?? 0);

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Plan name is required." },
        { status: 400 }
      );
    }

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Unable to create a valid plan slug." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { ok: false, error: "Plan amount must be 0 or greater." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(durationDays) || durationDays <= 0) {
      return NextResponse.json(
        { ok: false, error: "Plan duration must be at least 1 day." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from("plans")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { ok: false, error: existingError.message },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { ok: false, error: "A plan with this slug already exists." },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("plans")
      .insert({
        name,
        slug,
        description,
        price,
        duration_days: durationDays,
        is_active: body.isActive ?? true,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      })
      .select(
        `
          id,
          name,
          slug,
          description,
          price,
          duration_days,
          is_active,
          sort_order
        `
      )
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        plan: mapPlan(data as PlanRow),
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
            : "Unable to create subscription plan.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      id?: string;
      name?: string;
      slug?: string;
      description?: string;
      price?: number;
      durationDays?: number;
      isActive?: boolean;
      sortOrder?: number;
    };

    const id = body.id?.trim();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Plan id is required." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();

      if (!name) {
        return NextResponse.json(
          { ok: false, error: "Plan name cannot be empty." },
          { status: 400 }
        );
      }

      updates.name = name;
    }

    if (typeof body.slug === "string") {
      const slug = createSlug(body.slug);

      if (!slug) {
        return NextResponse.json(
          { ok: false, error: "Plan slug is invalid." },
          { status: 400 }
        );
      }

      const supabase = getSupabaseAdminClient();

      const { data: duplicate, error: duplicateError } = await supabase
        .from("plans")
        .select("id")
        .eq("slug", slug)
        .neq("id", id)
        .maybeSingle();

      if (duplicateError) {
        return NextResponse.json(
          { ok: false, error: duplicateError.message },
          { status: 500 }
        );
      }

      if (duplicate) {
        return NextResponse.json(
          { ok: false, error: "Another plan already uses this slug." },
          { status: 409 }
        );
      }

      updates.slug = slug;
    }

    if (typeof body.description === "string") {
      updates.description = body.description.trim();
    }

    if (typeof body.price === "number") {
      if (!Number.isFinite(body.price) || body.price < 0) {
        return NextResponse.json(
          { ok: false, error: "Plan amount must be 0 or greater." },
          { status: 400 }
        );
      }

      updates.price = body.price;
    }

    if (typeof body.durationDays === "number") {
      if (!Number.isInteger(body.durationDays) || body.durationDays <= 0) {
        return NextResponse.json(
          { ok: false, error: "Plan duration must be at least 1 day." },
          { status: 400 }
        );
      }

      updates.duration_days = body.durationDays;
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

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid plan fields were provided." },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("plans")
      .update(updates)
      .eq("id", id)
      .select(
        `
          id,
          name,
          slug,
          description,
          price,
          duration_days,
          is_active,
          sort_order
        `
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Plan was not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      plan: mapPlan(data as PlanRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update subscription plan.",
      },
      { status: 500 }
    );
  }
}
