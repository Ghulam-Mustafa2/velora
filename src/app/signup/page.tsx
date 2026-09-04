"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseAuthBrowserClient } from "@/lib/supabase/auth-client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createSupabaseAuthBrowserClient();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setErrorMessage("Please enter your display name.");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      setIsLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            display_name: cleanName,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        router.replace("/account");
        router.refresh();
        return;
      }

      setSuccessMessage(
        "Account created successfully. Please check your email to confirm your account, then sign in."
      );

      setDisplayName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0a0a] shadow-[0_30px_100px_rgba(0,0,0,0.55)] lg:grid-cols-[0.9fr_1.1fr]">
          <section className="relative hidden overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.22),transparent_42%),linear-gradient(145deg,#0d0d0d,#050505)] p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="relative h-14 w-36 overflow-hidden">
                <Image
                  src="/velora-logo.png"
                  alt="VELORA"
                  width={144}
                  height={56}
                  priority
                  className="h-full w-full object-contain object-left scale-[1.12]"
                />
              </div>

              <p className="mt-10 text-xs font-bold uppercase tracking-[0.32em] text-red-400">
                Viewer Accounts
              </p>

              <h1 className="mt-4 max-w-md text-5xl font-black leading-[0.95] tracking-[-0.04em]">
                Your VELORA experience starts here.
              </h1>

              <p className="mt-6 max-w-md text-base leading-7 text-white/55">
                Create your account to manage your profile and prepare for premium
                subscriptions and exclusive channel access.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm font-semibold text-white/85">
                Free account today.
              </p>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Premium plans and paid channel access will be added in the next phase.
              </p>
            </div>
          </section>

          <section className="p-5 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-xl">
              <div className="mb-8 flex items-center justify-between lg:hidden">
                <div className="relative h-12 w-32 overflow-hidden">
                  <Image
                    src="/velora-logo.png"
                    alt="VELORA"
                    width={128}
                    height={48}
                    priority
                    className="h-full w-full object-contain object-left scale-[1.12]"
                  />
                </div>

                <Link
                  href="/"
                  className="text-sm font-semibold text-white/50 transition hover:text-white"
                >
                  Home
                </Link>
              </div>

              <p className="text-xs font-bold uppercase tracking-[0.32em] text-red-400">
                Create Account
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Join VELORA
              </h2>

              <p className="mt-3 text-sm leading-6 text-white/50">
                Sign up with your email and create your personal viewer account.
              </p>

              {errorMessage ? (
                <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              {successMessage ? (
                <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-200">
                  {successMessage}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <div>
                  <label
                    htmlFor="displayName"
                    className="mb-2 block text-sm font-semibold text-white/75"
                  >
                    Display Name
                  </label>

                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                    placeholder="Your name"
                    disabled={isLoading}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-[#151515] px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/15 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-white/75"
                  >
                    Email
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    disabled={isLoading}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-[#151515] px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/15 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-semibold text-white/75"
                  >
                    Password
                  </label>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    disabled={isLoading}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-[#151515] px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/15 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-sm font-semibold text-white/75"
                  >
                    Confirm Password
                  </label>

                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Enter password again"
                    disabled={isLoading}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-[#151515] px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/15 disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-14 w-full items-center justify-center rounded-2xl bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                </button>
              </form>

              <div className="mt-7 border-t border-white/10 pt-6 text-center">
                <p className="text-sm text-white/45">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-red-400 transition hover:text-red-300"
                  >
                    Sign In
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}