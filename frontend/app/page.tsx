"use client";

import { useEffect, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
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
  User,
} from "@/lib/types";

const TOKEN_KEY = "datapulse_token";

const FINISHED_STATUSES: JobStatus[] = ["done", "error", "timeout"];

function getStoredToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);

  const [bootLoading, setBootLoading] = useState(false);
  const [jobLoading, setJobLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState("");

  const isLoggedIn = Boolean(token && user);

 useEffect(() => {
  const savedToken = getStoredToken();

  if (!savedToken) {
    return;
  }

  const tokenFromStorage: string = savedToken;
  let isMounted = true;

  async function restoreSession() {
    setBootLoading(true);

    try {
      const response = await api.me(tokenFromStorage);

      if (!isMounted) return;

      setToken(tokenFromStorage);
      setUser(response.data.user);
      await loadJobs(tokenFromStorage);
    } catch {
      removeToken();

      if (!isMounted) return;

      setToken(null);
      setUser(null);
    } finally {
      if (isMounted) {
        setBootLoading(false);
      }
    }
  }

  restoreSession();

  return () => {
    isMounted = false;
  };
}, []);

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
      } catch (error) {
        setError(getErrorMessage(error));
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
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setResultsLoading(false);
    }
  }

  function handleAuthenticated(input: { user: User; token: string }) {
    saveToken(input.token);
    setToken(input.token);
    setUser(input.user);
    setError("");
    loadJobs(input.token).catch((error) => setError(getErrorMessage(error)));
  }

  function handleLogout() {
    removeToken();
    setToken(null);
    setUser(null);
    setJobs([]);
    setActiveJob(null);
    setResults([]);
    setError("");
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
    } catch (error) {
      setError(getErrorMessage(error));
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
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }

  if (bootLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-semibold text-slate-600 shadow-sm">
          Loading DataPulse...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">DataPulse</h1>
            <p className="text-sm text-slate-500">
              Multi-Channel Web Scraping Platform
            </p>
          </div>

          {isLoggedIn && (
            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-slate-800">
                  {user?.name}
                </p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!isLoggedIn ? (
          <AuthPanel onAuthenticated={handleAuthenticated} onError={setError} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <CreateJobForm
              loading={jobLoading}
              onCreateJob={handleCreateJob}
            />

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
                    loadJobs(token).catch((error) =>
                      setError(getErrorMessage(error))
                    );
                  }
                }}
                onSelectJob={handleSelectJob}
              />

              <ResultsTable results={results} loading={resultsLoading} />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}