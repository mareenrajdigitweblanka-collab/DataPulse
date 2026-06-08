"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

const PASSWORD_RULES = [
  { key: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { key: "upper", label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { key: "number", label: "One number", test: (p: string) => /[0-9]/.test(p) },
];

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passedRules = PASSWORD_RULES.filter((rule) => rule.test(password));
  const strengthPercent =
    password.length === 0 ? 0 : (passedRules.length / PASSWORD_RULES.length) * 100;
  const strengthColor =
    strengthPercent <= 25
      ? "var(--error)"
      : strengthPercent <= 50
        ? "var(--warning)"
        : strengthPercent <= 75
          ? "#f59e0b"
          : "var(--success)";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!tokenFromUrl) {
      setError("Reset token is missing. Please use the link from your email.");
      return;
    }

    const allValid = PASSWORD_RULES.every((rule) => rule.test(password));
    if (!allValid) {
      setError("Please meet all password requirements.");
      return;
    }

    setLoading(true);

    try {
      await api.resetPassword({ token: tokenFromUrl, password });
      setSuccess(true);
      setTimeout(() => router.replace("/login"), 3000);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Reset failed. The token may be invalid or expired.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center">
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
          Password reset!
        </h2>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Your password has been reset successfully. Redirecting to login...
        </p>

        <div className="mt-6">
          <Link
            href="/login"
            className="text-sm font-semibold transition-colors hover:opacity-80"
            style={{ color: "var(--accent-primary)" }}
          >
            Go to login now →
          </Link>
        </div>
      </div>
    );
  }

  if (!tokenFromUrl) {
    return (
      <div className="text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "var(--error-soft)" }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--error)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>

        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Missing reset token
        </h2>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          This page requires a valid reset token. Please use the link sent to
          your email.
        </p>

        <div className="mt-6 space-x-4">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold transition-colors hover:opacity-80"
            style={{ color: "var(--accent-primary)" }}
          >
            Request new reset link
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold transition-colors hover:opacity-80"
            style={{ color: "var(--text-tertiary)" }}
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Set new password
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Choose a strong password for your account
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
            New password
          </label>
          <input
            id="reset-password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />

          {password.length > 0 && (
            <div className="mt-3 space-y-2">
              <div
                className="h-1 w-full overflow-hidden rounded-full"
                style={{ background: "var(--bg-tertiary)" }}
              >
                <div
                  className="strength-bar"
                  style={{
                    width: `${strengthPercent}%`,
                    backgroundColor: strengthColor,
                    height: "100%",
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-1">
                {PASSWORD_RULES.map((rule) => {
                  const passed = rule.test(password);
                  return (
                    <div
                      key={rule.key}
                      className="flex items-center gap-1.5 text-xs"
                      style={{
                        color: passed
                          ? "var(--success)"
                          : "var(--text-tertiary)",
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {passed ? (
                          <polyline points="20 6 9 17 4 12" />
                        ) : (
                          <circle cx="12" cy="12" r="10" />
                        )}
                      </svg>
                      {rule.label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button
          id="reset-submit"
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
              Resetting...
            </>
          ) : (
            "Reset password"
          )}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <span className="spinner" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
