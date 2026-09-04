"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseAuthBrowserClient } from "@/lib/supabase/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseAuthBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    try {
      setIsLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.replace("/account");
      router.refresh();
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
                Welcome Back
              </p>

              <h1 className="mt-4 max-w-md text-5xl font-black leading-[0.95] tracking-[-0.04em]">
                Continue your VELORA experience.
              </h1>

              <p className="mt-6 max-w-md text-base leading-7 text-white/55">
                Sign in to access your personal account, viewing preferences and
                future premium subscriptions.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm font-semibold text-white/85">
                Your account stays personal.
              </p>

              <p className="mt-2 text-sm leading-6 text-white/45">
                Your password is securely handled by Supabase Authentication and
                is never stored directly by VELORA.
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
                Viewer Login
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Sign in to VELORA
              </h2>

              <p className="mt-3 text-sm leading-6 text-white/50">
                Enter your email and password to continue.
              </p>

              {errorMessage ? (
                <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
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
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={isLoading}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-[#151515] px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/15 disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-14 w-full items-center justify-center rounded-2xl bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Signing In..." : "Sign In"}
                </button>
              </form>

              <div className="mt-7 border-t border-white/10 pt-6 text-center">
                <p className="text-sm text-white/45">
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/signup"
                    className="font-semibold text-red-400 transition hover:text-red-300"
                  >
                    Create Account
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