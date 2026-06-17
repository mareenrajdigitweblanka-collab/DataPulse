"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ApiClientError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* Redirect if already logged in */
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login({ email, password });
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "email_not_verified") {
        router.replace(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Welcome back
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Sign in to your account to continue
        </p>
      </div>

      {error && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "var(--error-soft)",
            color: "var(--error)",
            border: "1px solid var(--error)",
            borderColor: "color-mix(in srgb, var(--error) 30%, transparent)",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            className="mb-1.5 block text-sm font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Email address
          </label>
          <input
            id="login-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              className="text-sm font-semibold"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: "var(--accent-primary)" }}
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        <button
          id="login-submit"
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
          style={{
            background: "var(--gradient-brand)",
          }}
        >
          {loading ? (
            <>
              <span className="spinner" style={{ borderTopColor: "white", borderColor: "rgba(255,255,255,0.3)" }} />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p
        className="mt-6 text-center text-sm"
        style={{ color: "var(--text-tertiary)" }}
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-semibold transition-colors hover:opacity-80"
          style={{ color: "var(--accent-primary)" }}
        >
          Create account
        </Link>
      </p>
    </>
  );
}
