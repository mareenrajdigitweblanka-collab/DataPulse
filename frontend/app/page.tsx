"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CreateJobForm } from "@/components/CreateJobForm";
import { JobStatusCard } from "@/components/JobStatusCard";
import { RecentJobs } from "@/components/RecentJobs";
import { ResultsTable } from "@/components/ResultsTable";
import { api } from "@/lib/api";
import type {
  CreateJobPayload,
  Job,
  JobStatus,
  ResultRow,
} from "@/lib/types";

const FINISHED_STATUSES: JobStatus[] = ["done", "error", "timeout"];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, isLoading, isAuthenticated, logout } = useAuth();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);

  const [jobLoading, setJobLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState("");

  /* Redirect to login if not authenticated */
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  /* Load jobs on mount */
  useEffect(() => {
    if (token) {
      loadJobs(token).catch((err) => setError(getErrorMessage(err)));
    }
  }, [token]);

  /* Poll active job */
  useEffect(() => {
    if (!token || !activeJob) return;
    if (FINISHED_STATUSES.includes(activeJob.status)) return;

    const intervalId = window.setInterval(async () => {
      try {
        const response = await api.getJob(token, activeJob.id);
        const latestJob = response.data.job;

        setActiveJob(latestJob);

        if (FINISHED_STATUSES.includes(latestJob.status)) {
          await loadJobs(token);

          if (latestJob.status === "done") {
            await loadResults(token, latestJob.id);
          }
        }
      } catch (err) {
        setError(getErrorMessage(err));
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [token, activeJob?.id, activeJob?.status]);

  async function loadJobs(nextToken = token) {
    if (!nextToken) return;
    const response = await api.listJobs(nextToken);
    setJobs(response.data.jobs);
  }

  async function loadResults(nextToken: string, jobId: string) {
    setResultsLoading(true);
    setError("");

    try {
      const response = await api.getResults(nextToken, jobId);
      setResults(response.data.results);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResultsLoading(false);
    }
  }

  function handleLogout() {
    logout();
    setJobs([]);
    setActiveJob(null);
    setResults([]);
    setError("");
    router.replace("/login");
  }

  async function handleCreateJob(payload: CreateJobPayload) {
    if (!token) {
      setError("Please login first.");
      return;
    }

    setJobLoading(true);
    setError("");
    setResults([]);

    try {
      const created = await api.createJob(token, payload);
      const jobResponse = await api.getJob(token, created.data.jobId);

      setActiveJob(jobResponse.data.job);
      await loadJobs(token);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setJobLoading(false);
    }
  }

  async function handleSelectJob(job: Job) {
    if (!token) return;

    setError("");
    setResults([]);

    try {
      const response = await api.getJob(token, job.id);
      const freshJob = response.data.job;

      setActiveJob(freshJob);

      if (freshJob.status === "done") {
        await loadResults(token, freshJob.id);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  /* Loading state */
  if (isLoading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <div
          className="card flex items-center gap-3 px-6 py-5"
        >
          <span className="spinner" />
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Loading DataPulse...
          </span>
        </div>
      </main>
    );
  }

  /* Not authenticated — will redirect */
  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* ─── Header ─── */}
      <header
        className="border-b"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border-primary)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "var(--gradient-brand)" }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <h1
                className="text-lg font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                DataPulse
              </h1>
              <p
                className="text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                Multi-Channel Scraping
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {/* User info */}
            <div className="hidden text-right sm:block">
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {user?.name}
              </p>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {user?.email}
              </p>
            </div>

            {/* User avatar */}
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>

            <button
              id="dashboard-logout"
              type="button"
              onClick={handleLogout}
              className="rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                borderColor: "var(--border-secondary)",
                color: "var(--text-secondary)",
                background: "var(--bg-secondary)",
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ─── Content ─── */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div
            className="mb-6 rounded-xl px-4 py-3 text-sm animate-fade-in"
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

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <CreateJobForm loading={jobLoading} onCreateJob={handleCreateJob} />

          <section className="space-y-6">
            {activeJob && (
              <JobStatusCard
                job={activeJob}
                loadingResults={resultsLoading}
                onLoadResults={() => {
                  if (token) {
                    loadResults(token, activeJob.id);
                  }
                }}
              />
            )}

            <RecentJobs
              jobs={jobs}
              onRefresh={() => {
                if (token) {
                  loadJobs(token).catch((err) =>
                    setError(getErrorMessage(err))
                  );
                }
              }}
              onSelectJob={handleSelectJob}
            />

            <ResultsTable results={results} loading={resultsLoading} />
          </section>
        </div>
      </div>
    </main>
  );
}