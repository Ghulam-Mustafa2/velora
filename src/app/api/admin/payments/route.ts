import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/supabase/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const RECEIPT_BUCKET = "payment-receipts";
const RECEIPT_URL_TTL_SECONDS = 10 * 60;

type PaymentRequestRow = {
  id: string;
  user_id: string;
  plan_id: string;
  payment_method_id: string;
  amount: number | string;
  transaction_reference: string | null;
  receipt_path: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

async function buildAdminPaymentRequest(row: PaymentRequestRow) {
  const supabase = getSupabaseAdminClient();

  const [
    profileResult,
    planResult,
    methodResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", row.user_id)
      .maybeSingle(),
    supabase
      .from("plans")
      .select("name")
      .eq("id", row.plan_id)
      .maybeSingle(),
    supabase
      .from("payment_methods")
      .select("name")
      .eq("id", row.payment_method_id)
      .maybeSingle(),
  ]);

  let receiptUrl: string | null = null;

  if (row.receipt_path) {
    const { data } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(row.receipt_path, RECEIPT_URL_TTL_SECONDS);

    receiptUrl = data?.signedUrl ?? null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    userEmail: profileResult.data?.email ?? "",
    displayName: profileResult.data?.display_name ?? "",
    planId: row.plan_id,
    planName: planResult.data?.name ?? "Premium Plan",
    paymentMethodId: row.payment_method_id,
    paymentMethodName: methodResult.data?.name ?? "Payment method",
    amount: Number(row.amount ?? 0),
    transactionReference: row.transaction_reference,
    receiptPath: row.receipt_path,
    receiptUrl,
    status: row.status,
    adminNote: row.admin_note,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
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
      .from("payment_requests")
      .select(
        `
          id,
          user_id,
          plan_id,
          payment_method_id,
          amount,
          transaction_reference,
          receipt_path,
          status,
          admin_note,
          submitted_at,
          reviewed_at
        `
      )
      .order("submitted_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const paymentRequests = await Promise.all(
      ((data ?? []) as PaymentRequestRow[]).map(buildAdminPaymentRequest)
    );

    return NextResponse.json({
      ok: true,
      paymentRequests,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load payment requests.",
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
      decision?: "approved" | "rejected";
      adminNote?: string | null;
    };

    const id = body.id?.trim();
    const decision = body.decision;
    const adminNote = body.adminNote?.trim() || null;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Payment request id is required." },
        { status: 400 }
      );
    }

    if (decision !== "approved" && decision !== "rejected") {
      return NextResponse.json(
        { ok: false, error: "A valid review decision is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    const { data: paymentRequest, error: requestError } = await supabase
      .from("payment_requests")
      .select(
        `
          id,
          user_id,
          plan_id,
          payment_method_id,
          amount,
          transaction_reference,
          receipt_path,
          status,
          admin_note,
          submitted_at,
          reviewed_at
        `
      )
      .eq("id", id)
      .maybeSingle();

    if (requestError) {
      return NextResponse.json(
        { ok: false, error: requestError.message },
        { status: 500 }
      );
    }

    if (!paymentRequest) {
      return NextResponse.json(
        { ok: false, error: "Payment request was not found." },
        { status: 404 }
      );
    }

    if (paymentRequest.status !== "pending") {
      return NextResponse.json(
        {
          ok: false,
          error: "This payment request has already been reviewed.",
        },
        { status: 409 }
      );
    }

    if (decision === "approved") {
      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("id, duration_days, is_active")
        .eq("id", paymentRequest.plan_id)
        .maybeSingle();

      if (planError) {
        return NextResponse.json(
          { ok: false, error: planError.message },
          { status: 500 }
        );
      }

      if (!plan || !plan.is_active) {
        return NextResponse.json(
          {
            ok: false,
            error: "The subscription plan is no longer available.",
          },
          { status: 400 }
        );
      }

      const now = new Date();

      const { data: latestSubscription, error: subscriptionLookupError } =
        await supabase
          .from("subscriptions")
          .select("id, expires_at")
          .eq("user_id", paymentRequest.user_id)
          .eq("plan_id", paymentRequest.plan_id)
          .eq("status", "active")
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (subscriptionLookupError) {
        return NextResponse.json(
          { ok: false, error: subscriptionLookupError.message },
          { status: 500 }
        );
      }

      const currentExpiry = latestSubscription?.expires_at
        ? new Date(latestSubscription.expires_at)
        : null;

      const baseDate =
        currentExpiry && currentExpiry.getTime() > now.getTime()
          ? currentExpiry
          : now;

      const nextExpiry = new Date(baseDate);
      nextExpiry.setUTCDate(
        nextExpiry.getUTCDate() + Number(plan.duration_days ?? 30)
      );

      if (latestSubscription) {
        const { error: subscriptionUpdateError } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            expires_at: nextExpiry.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("id", latestSubscription.id);

        if (subscriptionUpdateError) {
          return NextResponse.json(
            { ok: false, error: subscriptionUpdateError.message },
            { status: 500 }
          );
        }
      } else {
        const { error: subscriptionInsertError } = await supabase
          .from("subscriptions")
          .insert({
            user_id: paymentRequest.user_id,
            plan_id: paymentRequest.plan_id,
            status: "active",
            starts_at: now.toISOString(),
            expires_at: nextExpiry.toISOString(),
          });

        if (subscriptionInsertError) {
          return NextResponse.json(
            { ok: false, error: subscriptionInsertError.message },
            { status: 500 }
          );
        }
      }
    }

    const reviewedAt = new Date().toISOString();

    const { data: reviewedRequest, error: reviewError } = await supabase
      .from("payment_requests")
      .update({
        status: decision,
        admin_note: adminNote,
        reviewed_at: reviewedAt,
        reviewed_by: admin.id,
        updated_at: reviewedAt,
      })
      .eq("id", id)
      .eq("status", "pending")
      .select(
        `
          id,
          user_id,
          plan_id,
          payment_method_id,
          amount,
          transaction_reference,
          receipt_path,
          status,
          admin_note,
          submitted_at,
          reviewed_at
        `
      )
      .maybeSingle();

    if (reviewError) {
      return NextResponse.json(
        { ok: false, error: reviewError.message },
        { status: 500 }
      );
    }

    if (!reviewedRequest) {
      return NextResponse.json(
        {
          ok: false,
          error: "This payment request was reviewed by another action.",
        },
        { status: 409 }
      );
    }

    const result = await buildAdminPaymentRequest(
      reviewedRequest as PaymentRequestRow
    );

    return NextResponse.json({
      ok: true,
      paymentRequest: result,
      message:
        decision === "approved"
          ? "Payment approved. Premium subscription is active or extended."
          : "Payment request rejected.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to review payment request.",
      },
      { status: 500 }
    );
  }
}
