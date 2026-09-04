"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseAuthBrowserClient } from "@/lib/supabase/auth-client";

type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  duration_days: number;
};

type PaymentMethod = {
  id: string;
  name: string;
  slug: string;
  account_title: string | null;
  account_number: string | null;
  iban: string | null;
  instructions: string | null;
};

type PaymentRequest = {
  id: string;
  plan_id: string;
  payment_method_id: string;
  amount: number;
  transaction_reference: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
};

type SubscriptionStatusResponse = {
  ok?: boolean;
  active?: boolean;
  activePlanIds?: string[];
  subscriptions?: Array<{
    id: string;
    plan_id: string;
    status: string;
    starts_at: string;
    expires_at: string;
  }>;
};

export default function AccountPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createSupabaseAuthBrowserClient()
  );

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fallbackEmail, setFallbackEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [activePlanIds, setActivePlanIds] = useState<string[]>([]);
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(null);

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadAccount() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        if (!isMounted) {
          return;
        }

        setFallbackEmail(user.email ?? "");

        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id, display_name, email, avatar_url, created_at, updated_at"
          )
          .eq("id", user.id)
          .single();

        if (!isMounted) {
          return;
        }

        if (error) {
          setErrorMessage(
            "Your account is active, but your profile could not be loaded."
          );
          return;
        }

        setProfile(data);

        const [
          plansResult,
          methodsResult,
          subscriptionResponse,
          requestsResponse,
        ] = await Promise.all([
          supabase
            .from("plans")
            .select("id, name, slug, description, price, duration_days")
            .eq("is_active", true)
            .order("price", { ascending: true }),
          supabase
            .from("payment_methods")
            .select(
              "id, name, slug, account_title, account_number, iban, instructions"
            )
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
          fetch("/api/account/subscription", {
            cache: "no-store",
          }),
          fetch("/api/account/payment-request", {
            cache: "no-store",
          }),
        ]);

        if (!isMounted) {
          return;
        }

        if (!plansResult.error && plansResult.data) {
          const normalizedPlans = plansResult.data.map((plan) => ({
            id: plan.id,
            name: plan.name,
            slug: plan.slug,
            description: plan.description,
            price: Number(plan.price ?? 0),
            duration_days: Number(plan.duration_days ?? 30),
          }));

          setPlans(normalizedPlans);

          if (normalizedPlans.length > 0) {
            setSelectedPlanId((current) => current || normalizedPlans[0].id);
          }
        }

        if (!methodsResult.error && methodsResult.data) {
          setPaymentMethods(methodsResult.data);

          if (methodsResult.data.length > 0) {
            setSelectedPaymentMethodId(
              (current) => current || methodsResult.data[0].id
            );
          }
        }

        if (subscriptionResponse.ok) {
          const subscriptionPayload =
            (await subscriptionResponse.json()) as SubscriptionStatusResponse;

          if (Array.isArray(subscriptionPayload.activePlanIds)) {
            setActivePlanIds(subscriptionPayload.activePlanIds);
          }

          const activeSubscriptions = Array.isArray(
            subscriptionPayload.subscriptions
          )
            ? subscriptionPayload.subscriptions
            : [];

          if (activeSubscriptions.length > 0) {
            const latestExpiry = [...activeSubscriptions]
              .map((subscription) => subscription.expires_at)
              .filter(Boolean)
              .sort()
              .at(-1);

            setSubscriptionExpiry(latestExpiry ?? null);
          }
        }

        if (requestsResponse.ok) {
          const requestsPayload = (await requestsResponse.json()) as {
            paymentRequests?: PaymentRequest[];
          };

          if (Array.isArray(requestsPayload.paymentRequests)) {
            setPaymentRequests(
              requestsPayload.paymentRequests.map((request) => ({
                ...request,
                amount: Number(request.amount ?? 0),
              }))
            );
          }
        }
      } catch {
        if (isMounted) {
          setErrorMessage("Unable to load your account.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAccount();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  async function handlePaymentSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setPaymentError("");
    setPaymentMessage("");

    if (!selectedPlanId) {
      setPaymentError("Please select a subscription plan.");
      return;
    }

    if (!selectedPaymentMethodId) {
      setPaymentError("Please select a payment method.");
      return;
    }

    if (!transactionReference.trim()) {
      setPaymentError("Transaction reference is required.");
      return;
    }

    if (!receiptFile) {
      setPaymentError("Please upload your payment receipt screenshot.");
      return;
    }

    try {
      setIsSubmittingPayment(true);

      const formData = new FormData();
      formData.append("planId", selectedPlanId);
      formData.append("paymentMethodId", selectedPaymentMethodId);
      formData.append("transactionReference", transactionReference.trim());
      formData.append("receipt", receiptFile);

      const response = await fetch("/api/account/payment-request", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        setPaymentError(
          payload.error ?? "Unable to submit your payment request."
        );
        return;
      }

      setPaymentMessage(
        payload.message ??
          "Payment submitted successfully and is waiting for admin review."
      );
      setTransactionReference("");
      setReceiptFile(null);

      const requestsResponse = await fetch("/api/account/payment-request", {
        cache: "no-store",
      });

      if (requestsResponse.ok) {
        const requestsPayload = (await requestsResponse.json()) as {
          paymentRequests?: PaymentRequest[];
        };

        if (Array.isArray(requestsPayload.paymentRequests)) {
          setPaymentRequests(
            requestsPayload.paymentRequests.map((request) => ({
              ...request,
              amount: Number(request.amount ?? 0),
            }))
          );
        }
      }
    } catch {
      setPaymentError("Unable to submit your payment request.");
    } finally {
      setIsSubmittingPayment(false);
    }
  }

  async function handleLogout() {
    try {
      setIsLoggingOut(true);

      await supabase.auth.signOut();

      router.replace("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  const displayName =
    profile?.display_name?.trim() || "VELORA Viewer";

  const email =
    profile?.email?.trim() || fallbackEmail || "No email available";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const hasPremium = activePlanIds.length > 0;

  const currentPlan = hasPremium
    ? plans.find((plan) => activePlanIds.includes(plan.id)) ?? null
    : null;

  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ?? null;

  const selectedPaymentMethod =
    paymentMethods.find(
      (method) => method.id === selectedPaymentMethodId
    ) ?? null;

  const formatDate = (value: string | null) => {
    if (!value) {
      return "No expiry";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-red-500" />

          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.25em] text-white/45">
            Loading Account
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="block">
            <div className="relative h-12 w-32 overflow-hidden">
              <Image
                src="/velora-logo.png"
                alt="VELORA"
                width={128}
                height={48}
                priority
                className="h-full w-full scale-[1.12] object-contain object-left"
              />
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:text-white"
            >
              Watch TV
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-full border border-red-500/25 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoggingOut ? "Logging Out..." : "Logout"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.16),transparent_35%),#0a0a0a] p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-red-400">
                Viewer Account
              </p>

              <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                My Account
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-white/50">
                Manage your VELORA identity and view your current access status.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />

              <span className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
                Account Active
              </span>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm leading-6 text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[28px] border border-white/10 bg-[#0a0a0a] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/35">
              Profile
            </p>

            <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[26px] border border-red-500/20 bg-gradient-to-br from-red-500/20 to-black text-2xl font-black text-white">
                {initials || "V"}
              </div>

              <div className="min-w-0">
                <h2 className="break-words text-3xl font-black tracking-tight">
                  {displayName}
                </h2>

                <p className="mt-2 break-all text-base text-white/50">
                  {email}
                </p>

                <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white/55">
                  Verified Viewer
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/35">
                  Display Name
                </p>

                <p className="mt-3 font-semibold text-white/85">
                  {displayName}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/35">
                  Email
                </p>

                <p className="mt-3 break-all font-semibold text-white/85">
                  {email}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-red-500/20 bg-[linear-gradient(145deg,rgba(127,29,29,0.15),rgba(10,10,10,1)_55%)] p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-400">
                  Current Plan
                </p>

                <h2 className="mt-4 text-3xl font-black tracking-tight">
                  {hasPremium ? currentPlan?.name ?? "Premium Plan" : "Free Plan"}
                </h2>
              </div>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                Active
              </span>
            </div>

            <p className="mt-5 text-sm leading-7 text-white/50">
              {hasPremium
                ? "Your premium access is active. You can watch channels included in your active VELORA plan."
                : "Your free VELORA account gives you access to channels marked as free. Upgrade below to unlock premium channels."}
            </p>

            <div className="my-7 h-px bg-white/10" />

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-5">
                <span className="text-sm text-white/45">
                  Subscription
                </span>

                <span className="text-sm font-semibold text-white">
                  {hasPremium ? currentPlan?.name ?? "Premium" : "Free"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-5">
                <span className="text-sm text-white/45">
                  Premium channels
                </span>

                <span className="text-sm font-semibold text-white/55">
                  {hasPremium ? "Unlocked" : "Locked"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-5">
                <span className="text-sm text-white/45">
                  Expiry
                </span>

                <span className="text-sm font-semibold text-white">
                  {hasPremium ? formatDate(subscriptionExpiry) : "No expiry"}
                </span>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="font-semibold text-white/85">
                {hasPremium ? "Premium access active" : "Upgrade available"}
              </p>

              <p className="mt-2 text-sm leading-6 text-white/45">
                {hasPremium
                  ? `Your premium access is active until ${formatDate(
                      subscriptionExpiry
                    )}.`
                  : "Choose a plan below and submit your Easypaisa, JazzCash or bank transfer receipt for admin review."}
              </p>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#0a0a0a] p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-400">
              Premium Upgrade
            </p>
            <h3 className="text-2xl font-black tracking-tight sm:text-3xl">
              Submit a manual payment
            </h3>
            <p className="max-w-3xl text-sm leading-7 text-white/45">
              Send the exact plan amount using one of the available payment
              methods, then upload your receipt. Your request will remain
              pending until an admin reviews it.
            </p>
          </div>

          {paymentError ? (
            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
              {paymentError}
            </div>
          ) : null}

          {paymentMessage ? (
            <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
              {paymentMessage}
            </div>
          ) : null}

          <form
            onSubmit={handlePaymentSubmit}
            className="mt-7 grid gap-6 lg:grid-cols-2"
          >
            <div className="space-y-5">
              <label className="block space-y-2 text-sm text-white/65">
                Subscription Plan
                <select
                  value={selectedPlanId}
                  onChange={(event) => setSelectedPlanId(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#151515] px-4 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                >
                  {plans.length === 0 ? (
                    <option value="">No active plans available</option>
                  ) : (
                    plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} — PKR {plan.price} / {plan.duration_days} days
                      </option>
                    ))
                  )}
                </select>
              </label>

              {selectedPlan ? (
                <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.05] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">
                    Amount to send
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    PKR {selectedPlan.price}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    {selectedPlan.description ||
                      `${selectedPlan.duration_days} days of VELORA premium access.`}
                  </p>
                </div>
              ) : null}

              <label className="block space-y-2 text-sm text-white/65">
                Payment Method
                <select
                  value={selectedPaymentMethodId}
                  onChange={(event) =>
                    setSelectedPaymentMethodId(event.target.value)
                  }
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#151515] px-4 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                >
                  {paymentMethods.length === 0 ? (
                    <option value="">No payment methods available</option>
                  ) : (
                    paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              {selectedPaymentMethod ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-sm">
                  <p className="font-bold text-white">
                    {selectedPaymentMethod.name}
                  </p>

                  <div className="mt-4 space-y-2 text-white/50">
                    {selectedPaymentMethod.account_title ? (
                      <p>
                        Account title:{" "}
                        <span className="font-semibold text-white/80">
                          {selectedPaymentMethod.account_title}
                        </span>
                      </p>
                    ) : null}

                    {selectedPaymentMethod.account_number ? (
                      <p>
                        Account number:{" "}
                        <span className="font-semibold text-white/80">
                          {selectedPaymentMethod.account_number}
                        </span>
                      </p>
                    ) : null}

                    {selectedPaymentMethod.iban ? (
                      <p>
                        IBAN:{" "}
                        <span className="break-all font-semibold text-white/80">
                          {selectedPaymentMethod.iban}
                        </span>
                      </p>
                    ) : null}

                    <p className="leading-6">
                      {selectedPaymentMethod.instructions ||
                        "Send the exact plan amount and keep your payment receipt."}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-5">
              <label className="block space-y-2 text-sm text-white/65">
                Transaction / Reference ID
                <input
                  type="text"
                  value={transactionReference}
                  onChange={(event) =>
                    setTransactionReference(event.target.value)
                  }
                  placeholder="Enter transaction ID or reference"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#151515] px-4 text-white placeholder:text-white/30 outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                />
              </label>

              <label className="block space-y-2 text-sm text-white/65">
                Payment Receipt
                <input
                  key={`${receiptFile?.name ?? "empty"}-${receiptFile?.size ?? 0}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setReceiptFile(event.target.files?.[0] ?? null)
                  }
                  className="block w-full rounded-2xl border border-dashed border-white/15 bg-[#111] px-4 py-5 text-sm text-white/60 file:mr-4 file:rounded-full file:border-0 file:bg-red-600 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-red-500"
                />
              </label>

              {receiptFile ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm text-white/55">
                  Selected:{" "}
                  <span className="font-semibold text-white/80">
                    {receiptFile.name}
                  </span>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={
                  isSubmittingPayment ||
                  !selectedPlanId ||
                  !selectedPaymentMethodId
                }
                className="min-h-12 w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingPayment
                  ? "Submitting Payment..."
                  : "Submit Payment for Review"}
              </button>

              <p className="text-xs leading-5 text-white/35">
                Receipts are stored privately. Submission does not activate a
                subscription immediately; access starts only after admin approval.
              </p>
            </div>
          </form>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#0a0a0a] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/35">
                Payment History
              </p>
              <h3 className="mt-2 text-xl font-bold">
                Your payment requests
              </h3>
            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-white/50">
              {paymentRequests.length}
            </span>
          </div>

          {paymentRequests.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-8 text-center text-sm text-white/40">
              No payment requests yet.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {paymentRequests.map((request) => {
                const plan = plans.find((item) => item.id === request.plan_id);
                const method = paymentMethods.find(
                  (item) => item.id === request.payment_method_id
                );

                const statusClass =
                  request.status === "approved"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                    : request.status === "rejected"
                      ? "border-red-500/20 bg-red-500/10 text-red-300"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-200";

                return (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold text-white">
                          {plan?.name ?? "Premium Plan"}
                        </p>
                        <p className="mt-1 text-sm text-white/45">
                          {method?.name ?? "Payment method"} • PKR{" "}
                          {request.amount}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${statusClass}`}
                      >
                        {request.status}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-white/45 sm:grid-cols-2">
                      <p>
                        Reference:{" "}
                        <span className="font-semibold text-white/70">
                          {request.transaction_reference || "—"}
                        </span>
                      </p>
                      <p>
                        Submitted:{" "}
                        <span className="font-semibold text-white/70">
                          {formatDate(request.submitted_at)}
                        </span>
                      </p>
                    </div>

                    {request.admin_note ? (
                      <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 text-white/55">
                        Admin note: {request.admin_note}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#0a0a0a] p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/35">
                Session
              </p>

              <h3 className="mt-2 text-xl font-bold">
                Account security
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/45">
                Sign out when you are using VELORA on a shared device.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="h-12 rounded-2xl border border-red-500/25 bg-red-500/10 px-6 text-sm font-bold text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoggingOut ? "Logging Out..." : "Logout"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}