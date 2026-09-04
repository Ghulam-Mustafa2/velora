import { NextResponse } from "next/server";

import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const RECEIPT_BUCKET = "payment-receipts";
const MAX_RECEIPT_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_RECEIPT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getFileExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  return "jpg";
}

export async function POST(request: Request) {
  let uploadedReceiptPath: string | null = null;

  try {
    /*
     * -------------------------------------------------------
     * 1. VERIFY SIGNED-IN USER
     * -------------------------------------------------------
     */
    const authSupabase =
      await createSupabaseAuthServerClient();

    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "You must be signed in to submit a payment.",
        },
        { status: 401 }
      );
    }

    /*
     * -------------------------------------------------------
     * 2. READ MULTIPART FORM
     * -------------------------------------------------------
     */
    const formData = await request.formData();

    const planId = String(
      formData.get("planId") ?? ""
    ).trim();

    const paymentMethodId = String(
      formData.get("paymentMethodId") ?? ""
    ).trim();

    const transactionReference = String(
      formData.get("transactionReference") ?? ""
    ).trim();

    const receiptValue =
      formData.get("receipt");

    if (!planId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please select a subscription plan.",
        },
        { status: 400 }
      );
    }

    if (!paymentMethodId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please select a payment method.",
        },
        { status: 400 }
      );
    }

    if (!transactionReference) {
      return NextResponse.json(
        {
          ok: false,
          error: "Transaction reference is required.",
        },
        { status: 400 }
      );
    }

    if (!(receiptValue instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Payment receipt screenshot is required.",
        },
        { status: 400 }
      );
    }

    const receipt = receiptValue;

    if (receipt.size <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "The selected receipt file is empty.",
        },
        { status: 400 }
      );
    }

    if (receipt.size > MAX_RECEIPT_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          error: "Receipt image must be 5 MB or smaller.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_RECEIPT_TYPES.has(receipt.type)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Receipt must be a JPG, PNG or WEBP image.",
        },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * 3. VERIFY PLAN + PAYMENT METHOD SERVER-SIDE
     * -------------------------------------------------------
     *
     * Important:
     * Client does NOT decide the amount.
     * We load the real price directly from the plans table.
     */
    const adminSupabase =
      getSupabaseAdminClient();

    const { data: plan, error: planError } =
      await adminSupabase
        .from("plans")
        .select(
          "id, name, slug, price, duration_days, is_active"
        )
        .eq("id", planId)
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

    const {
      data: paymentMethod,
      error: paymentMethodError,
    } = await adminSupabase
      .from("payment_methods")
      .select(
        "id, name, slug, is_active"
      )
      .eq("id", paymentMethodId)
      .maybeSingle();

    if (paymentMethodError) {
      return NextResponse.json(
        {
          ok: false,
          error: paymentMethodError.message,
        },
        { status: 500 }
      );
    }

    if (
      !paymentMethod ||
      !paymentMethod.is_active
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The selected payment method is unavailable.",
        },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * 4. PREVENT MULTIPLE PENDING REQUESTS FOR SAME PLAN
     * -------------------------------------------------------
     */
    const {
      data: existingPending,
      error: pendingError,
    } = await adminSupabase
      .from("payment_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("plan_id", plan.id)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      return NextResponse.json(
        {
          ok: false,
          error: pendingError.message,
        },
        { status: 500 }
      );
    }

    if (existingPending) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You already have a pending payment request for this plan.",
        },
        { status: 409 }
      );
    }

    /*
     * -------------------------------------------------------
     * 5. UPLOAD RECEIPT TO PRIVATE STORAGE
     * -------------------------------------------------------
     */
    const extension =
      getFileExtension(receipt);

    const fileId =
      crypto.randomUUID();

    uploadedReceiptPath =
      `${user.id}/${fileId}.${extension}`;

    const fileBuffer =
      await receipt.arrayBuffer();

    const {
      error: uploadError,
    } = await adminSupabase.storage
      .from(RECEIPT_BUCKET)
      .upload(
        uploadedReceiptPath,
        fileBuffer,
        {
          contentType: receipt.type,
          cacheControl: "3600",
          upsert: false,
        }
      );

    if (uploadError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Unable to upload receipt: ${uploadError.message}`,
        },
        { status: 500 }
      );
    }

    /*
     * -------------------------------------------------------
     * 6. CREATE PENDING PAYMENT REQUEST
     * -------------------------------------------------------
     */
    const {
      data: paymentRequest,
      error: insertError,
    } = await adminSupabase
      .from("payment_requests")
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        payment_method_id:
          paymentMethod.id,

        // Price comes from the trusted plan record.
        amount: Number(plan.price),

        transaction_reference:
          transactionReference,

        receipt_path:
          uploadedReceiptPath,

        status: "pending",
      })
      .select(
        `
          id,
          plan_id,
          payment_method_id,
          amount,
          transaction_reference,
          receipt_path,
          status,
          submitted_at
        `
      )
      .single();

    if (insertError) {
      /*
       * Database insert failed after receipt upload.
       * Remove the orphaned private receipt.
       */
      await adminSupabase.storage
        .from(RECEIPT_BUCKET)
        .remove([uploadedReceiptPath]);

      uploadedReceiptPath = null;

      return NextResponse.json(
        {
          ok: false,
          error: insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,

        message:
          "Payment submitted successfully. Your payment is now waiting for admin review.",

        paymentRequest: {
          id: paymentRequest.id,
          planId:
            paymentRequest.plan_id,
          paymentMethodId:
            paymentRequest.payment_method_id,
          amount:
            Number(paymentRequest.amount),
          transactionReference:
            paymentRequest.transaction_reference,
          status:
            paymentRequest.status,
          submittedAt:
            paymentRequest.submitted_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    /*
     * Best-effort cleanup if something unexpected happens
     * after a receipt was uploaded.
     */
    if (uploadedReceiptPath) {
      try {
        const adminSupabase =
          getSupabaseAdminClient();

        await adminSupabase.storage
          .from(RECEIPT_BUCKET)
          .remove([uploadedReceiptPath]);
      } catch {
        // Avoid hiding the original server error.
      }
    }

    console.error(
      "[VELORA PAYMENT REQUEST]",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to submit payment request.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    /*
     * Signed-in user can retrieve only their own requests.
     */
    const authSupabase =
      await createSupabaseAuthServerClient();

    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const adminSupabase =
      getSupabaseAdminClient();

    const {
      data,
      error,
    } = await adminSupabase
      .from("payment_requests")
      .select(
        `
          id,
          plan_id,
          payment_method_id,
          amount,
          transaction_reference,
          status,
          admin_note,
          submitted_at,
          reviewed_at,
          created_at
        `
      )
      .eq("user_id", user.id)
      .order(
        "submitted_at",
        { ascending: false }
      );

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
      paymentRequests:
        data ?? [],
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