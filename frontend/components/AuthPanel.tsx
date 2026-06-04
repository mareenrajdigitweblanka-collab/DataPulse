"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { Field } from "./ui";

type AuthMode = "login" | "register";

export function AuthPanel({
  onAuthenticated,
  onError,
}: {
  onAuthenticated: (input: { user: User; token: string }) => void;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("Mareenraj");
  const [email, setEmail] = useState("mareenraj@example.com");
  const [password, setPassword] = useState("Password123!");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    onError("");

    try {
      const response =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ name, email, password });

      onAuthenticated({
        user: response.data.user,
        token: response.data.token,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Authentication failed";
      onError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Welcome to DataPulse</h1>
        <p className="mt-1 text-sm text-slate-500">
          Login or create an account to start scraping jobs.
        </p>
      </div>

      <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${
            mode === "login"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-500"
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${
            mode === "register"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-500"
          }`}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <Field label="Name">
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>
        )}

        <Field label="Email">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>

        <Field
          label="Password"
          hint="Password must contain uppercase, lowercase, and number."
        >
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800"
        >
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
        </button>
      </form>
    </section>
  );
}