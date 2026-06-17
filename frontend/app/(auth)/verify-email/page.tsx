"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiClientError } from "@/lib/api";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const { verifyOtp } = useAuth();

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!email) router.replace("/register");
  }, [email, router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (!email) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(otp)) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    try {
      await verifyOtp({ email, otp });
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "invalid_or_expired_otp") {
        setError("That code is invalid or has expired. Check your email or request a new one.");
      } else {
        setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setSuccess("");
    setResendLoading(true);
    try {
      await api.resendOtp({ email });
      setSuccess("A new code has been sent to your email.");
      setResendCooldown(60);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "resend_too_soon") {
        setError("Please wait a moment before requesting another code.");
        setResendCooldown(60);
      } else {
        setError(err instanceof Error ? err.message : "Failed to resend. Please try again.");
      }
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Check your email
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          We sent a 6-digit code to{" "}
          <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
        </p>
      </div>

      {error && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "var(--error-soft)",
            color: "var(--error)",
            border: "1px solid",
            borderColor: "color-mix(in srgb, var(--error) 30%, transparent)",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "color-mix(in srgb, var(--success) 10%, transparent)",
            color: "var(--success)",
            border: "1px solid",
            borderColor: "color-mix(in srgb, var(--success) 30%, transparent)",
          }}
        >
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            className="mb-1.5 block text-sm font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Verification code
          </label>
          <input
            className="input text-center text-2xl font-bold tracking-[0.5em]"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            autoComplete="one-time-code"
            autoFocus
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{ background: "var(--gradient-brand)" }}
        >
          {loading ? (
            <>
              <span
                className="spinner"
                style={{
                  borderTopColor: "white",
                  borderColor: "rgba(255,255,255,0.3)",
                }}
              />
              Verifying...
            </>
          ) : (
            "Verify email"
          )}
        </button>
      </form>

      <p
        className="mt-6 text-center text-sm"
        style={{ color: "var(--text-tertiary)" }}
      >
        Didn&apos;t receive the code?{" "}
        <button
          type="button"
          disabled={resendLoading || resendCooldown > 0}
          onClick={handleResend}
          className="font-semibold transition-colors hover:opacity-80 disabled:opacity-40"
          style={{ color: "var(--accent-primary)" }}
        >
          {resendCooldown > 0
            ? `Resend in ${resendCooldown}s`
            : resendLoading
              ? "Sending..."
              : "Resend code"}
        </button>
      </p>

      <p
        className="mt-3 text-center text-sm"
        style={{ color: "var(--text-tertiary)" }}
      >
        <Link
          href="/register"
          className="font-semibold transition-colors hover:opacity-80"
          style={{ color: "var(--accent-primary)" }}
        >
          Back to registration
        </Link>
      </p>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
