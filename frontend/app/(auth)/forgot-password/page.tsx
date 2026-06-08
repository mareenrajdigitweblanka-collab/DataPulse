"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.forgotPassword({ email });
      setSubmitted(true);

      /* Dev mode: backend returns resetToken for local testing */
      if (response.data.resetToken) {
        setDevToken(response.data.resetToken);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <>
        <div className="text-center">
          {/* Success icon */}
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "var(--success-soft)" }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--success)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h2
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Check your email
          </h2>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            If an account with <strong>{email}</strong> exists, we&apos;ve
            sent a password reset link.
          </p>
        </div>

        {/* Dev-mode: show reset token for testing */}
        {devToken && (
          <div
            className="mt-6 rounded-xl p-4 text-sm"
            style={{
              background: "var(--warning-soft)",
              border: "1px solid",
              borderColor: "color-mix(in srgb, var(--warning) 30%, transparent)",
            }}
          >
            <p className="mb-2 font-semibold" style={{ color: "var(--warning)" }}>
              🛠 Dev Mode — Reset Token
            </p>
            <p
              className="mb-3 break-all font-mono text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              {devToken}
            </p>
            <Link
              href={`/reset-password?token=${devToken}`}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors"
              style={{ background: "var(--accent-primary)" }}
            >
              Reset Password →
            </Link>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm font-semibold transition-colors hover:opacity-80"
            style={{ color: "var(--accent-primary)" }}
          >
            ← Back to login
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Forgot password?
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Enter your email and we&apos;ll send a reset link
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
            id="forgot-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>

        <button
          id="forgot-submit"
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
              Sending...
            </>
          ) : (
            "Send reset link"
          )}
        </button>
      </form>

      <p
        className="mt-6 text-center text-sm"
        style={{ color: "var(--text-tertiary)" }}
      >
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-semibold transition-colors hover:opacity-80"
          style={{ color: "var(--accent-primary)" }}
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
