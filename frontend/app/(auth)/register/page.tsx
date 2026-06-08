"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const PASSWORD_RULES = [
  { key: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { key: "upper", label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { key: "number", label: "One number", test: (p: string) => /[0-9]/.test(p) },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated } = useAuth();

  const [name, setName] = useState("");
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

    const allValid = PASSWORD_RULES.every((rule) => rule.test(password));
    if (!allValid) {
      setError("Please meet all password requirements.");
      return;
    }

    setLoading(true);

    try {
      await register({ name, email, password });
      router.replace("/");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again.";
      setError(message);
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
          Create your account
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Start scraping in minutes — no credit card required
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
            Full name
          </label>
          <input
            id="register-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Smith"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
          />
        </div>

        <div>
          <label
            className="mb-1.5 block text-sm font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Email address
          </label>
          <input
            id="register-email"
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
          <label
            className="mb-1.5 block text-sm font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Password
          </label>
          <input
            id="register-password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />

          {/* Password strength bar */}
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
          id="register-submit"
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
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p
        className="mt-6 text-center text-sm"
        style={{ color: "var(--text-tertiary)" }}
      >
        Already have an account?{" "}
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
