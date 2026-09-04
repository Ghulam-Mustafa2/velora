import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/supabase/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PaymentMethodRow = {
  id: string;
  name: string;
  slug: string;
  account_title: string | null;
  account_number: string | null;
  iban: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
};

function mapPaymentMethod(row: PaymentMethodRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    accountTitle: row.account_title ?? "",
    accountNumber: row.account_number ?? "",
    iban: row.iban ?? "",
    instructions: row.instructions ?? "",
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
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
      .from("payment_methods")
      .select(
        `
          id,
          name,
          slug,
          account_title,
          account_number,
          iban,
          instructions,
          is_active,
          sort_order
        `
      )
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      paymentMethods: ((data ?? []) as PaymentMethodRow[]).map(
        mapPaymentMethod
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load payment methods.",
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
      accountTitle?: string;
      accountNumber?: string;
      iban?: string;
      instructions?: string;
      isActive?: boolean;
      sortOrder?: number;
    };

    const id = body.id?.trim();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Payment method id is required." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.accountTitle === "string") {
      updates.account_title = body.accountTitle.trim() || null;
    }

    if (typeof body.accountNumber === "string") {
      updates.account_number = body.accountNumber.trim() || null;
    }

    if (typeof body.iban === "string") {
      updates.iban = body.iban.trim() || null;
    }

    if (typeof body.instructions === "string") {
      updates.instructions = body.instructions.trim() || null;
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
        { ok: false, error: "No valid fields were provided." },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("payment_methods")
      .update(updates)
      .eq("id", id)
      .select(
        `
          id,
          name,
          slug,
          account_title,
          account_number,
          iban,
          instructions,
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
        { ok: false, error: "Payment method was not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      paymentMethod: mapPaymentMethod(data as PaymentMethodRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update payment method.",
      },
      { status: 500 }
    );
  }
}
