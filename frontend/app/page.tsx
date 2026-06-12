"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CreateJobForm } from "@/components/CreateJobForm";
import { JobStatusCard } from "@/components/JobStatusCard";
import { RecentJobs } from "@/components/RecentJobs";
import { ResultsTable } from "@/components/ResultsTable";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { api } from "@/lib/api";
import type {
  CreateJobPayload,
  Job,
  JobStatus,
  ResultRow,
  ResultsSortBy,
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

  const [jobPage, setJobPage] = useState(1);
  const [jobLimit] = useState(7);
  const [jobTotal, setJobTotal] = useState(0);
  const [jobTotalPages, setJobTotalPages] = useState(1);
  const [hasPreviousJobsPage, setHasPreviousJobsPage] = useState(false);
  const [hasNextJobsPage, setHasNextJobsPage] = useState(false);

  const [resultSortBy, setResultSortBy] =
    useState<ResultsSortBy>("position");
  const [resultPage, setResultPage] = useState(1);
  const [resultLimit] = useState(50);
  const [resultTotal, setResultTotal] = useState(0);
  const [resultTotalPages, setResultTotalPages] = useState(1);
  const [hasPreviousResultsPage, setHasPreviousResultsPage] = useState(false);
  const [hasNextResultsPage, setHasNextResultsPage] = useState(false);

  const [jobPendingDelete, setJobPendingDelete] = useState<Job | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) {
      loadJobs(token, 1).catch((err) => setError(getErrorMessage(err)));
    }
  }, [token]);

  useEffect(() => {
    if (!token || !activeJob) return;
    if (FINISHED_STATUSES.includes(activeJob.status)) return;

    const intervalId = window.setInterval(async () => {
      try {
        const response = await api.getJob(token, activeJob.id);
        const latestJob = response.data.job;

        setActiveJob(latestJob);

        if (FINISHED_STATUSES.includes(latestJob.status)) {
          await loadJobs(token, jobPage);

          if (latestJob.status === "done") {
            await loadResults(latestJob.id, 1, resultSortBy);
          }
        }
      } catch (err) {
        setError(getErrorMessage(err));
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [token, activeJob?.id, activeJob?.status, jobPage, resultSortBy]);

  async function loadJobs(nextToken = token, page = jobPage) {
    if (!nextToken) return;

    const response = await api.listJobs(nextToken, page, jobLimit);

    setJobs(response.data.jobs);
    setJobPage(response.data.page);
    setJobTotal(response.data.total);
    setJobTotalPages(response.data.totalPages);
    setHasPreviousJobsPage(response.data.hasPreviousPage);
    setHasNextJobsPage(response.data.hasNextPage);
  }

  async function handlePreviousJobsPage() {
    if (!token || !hasPreviousJobsPage) return;
    await loadJobs(token, jobPage - 1);
  }

  async function handleNextJobsPage() {
    if (!token || !hasNextJobsPage) return;
    await loadJobs(token, jobPage + 1);
  }

  async function loadResults(
    jobId: string,
    page = resultPage,
    sortBy = resultSortBy
  ) {
    if (!token) return;

    setResultsLoading(true);
    setError("");

    try {
      const response = await api.getResults(
        token,
        jobId,
        page,
        resultLimit,
        sortBy
      );

      const total = Number(response.data.total ?? response.data.results.length);
      const totalPages = Number(
        response.data.totalPages ?? Math.max(Math.ceil(total / resultLimit), 1)
      );

      setResults(response.data.results);
      setResultPage(Number(response.data.page ?? page));
      setResultTotal(total);
      setResultTotalPages(totalPages);
      setHasPreviousResultsPage(
        response.data.hasPreviousPage ?? page > 1
      );
      setHasNextResultsPage(
        response.data.hasNextPage ?? page < totalPages
      );
    } finally {
      setResultsLoading(false);
    }
  }

  async function handlePreviousResultsPage() {
    if (!activeJob || !hasPreviousResultsPage) return;
    await loadResults(activeJob.id, resultPage - 1, resultSortBy);
  }

  async function handleNextResultsPage() {
    if (!activeJob || !hasNextResultsPage) return;
    await loadResults(activeJob.id, resultPage + 1, resultSortBy);
  }

  async function handleResultSortChange(nextSortBy: ResultsSortBy) {
    setResultSortBy(nextSortBy);
    setResultPage(1);

    if (!activeJob) return;
    await loadResults(activeJob.id, 1, nextSortBy);
  }

  function resetResultsState() {
    setResults([]);
    setResultPage(1);
    setResultTotal(0);
    setResultTotalPages(1);
    setHasPreviousResultsPage(false);
    setHasNextResultsPage(false);
  }

  function handleLogout() {
    logout();
    setJobs([]);
    setActiveJob(null);
    resetResultsState();
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
    resetResultsState();

    try {
      const created = await api.createJob(token, payload);
      const jobResponse = await api.getJob(token, created.data.jobId);

      setActiveJob(jobResponse.data.job);
      await loadJobs(token, 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setJobLoading(false);
    }
  }

  async function handleSelectJob(job: Job) {
    if (!token) return;

    setError("");
    resetResultsState();

    try {
      const response = await api.getJob(token, job.id);
      const freshJob = response.data.job;

      setActiveJob(freshJob);

      if (freshJob.status === "done") {
        await loadResults(freshJob.id, 1, resultSortBy);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function handleDeleteJob(job: Job) {
    setJobPendingDelete(job);
  }

  async function confirmDeleteJob() {
    if (!token || !jobPendingDelete) return;

    setDeleteLoading(true);
    setDeletingJobId(jobPendingDelete.id);
    setError("");

    try {
      await api.deleteJob(token, jobPendingDelete.id);

      if (activeJob?.id === jobPendingDelete.id) {
        setActiveJob(null);
        resetResultsState();
      }

      const nextTotal = Math.max(jobTotal - 1, 0);
      const nextTotalPages = Math.max(Math.ceil(nextTotal / jobLimit), 1);
      const nextPage = Math.min(jobPage, nextTotalPages);

      setJobPendingDelete(null);

      await loadJobs(token, nextPage);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleteLoading(false);
      setDeletingJobId(null);
    }
  }

  if (isLoading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="card flex items-center gap-3 px-6 py-5">
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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <header
        className="border-b"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border-primary)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
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

        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <CreateJobForm loading={jobLoading} onCreateJob={handleCreateJob} />

            <section className="space-y-6">
              {activeJob && (
                <JobStatusCard
                  job={activeJob}
                  loadingResults={resultsLoading}
                  onLoadResults={() => {
                    loadResults(activeJob.id, 1, resultSortBy).catch((err) =>
                      setError(getErrorMessage(err))
                    );
                  }}
                />
              )}
              <RecentJobs
                jobs={jobs}
                page={jobPage}
                totalPages={jobTotalPages}
                total={jobTotal}
                hasPreviousPage={hasPreviousJobsPage}
                hasNextPage={hasNextJobsPage}
                activeJobId={activeJob?.id ?? null}
                deletingJobId={deletingJobId}
                onRefresh={() => {
                  if (token) {
                    loadJobs(token, jobPage).catch((err) =>
                      setError(getErrorMessage(err))
                    );
                  }
                }}
                onPreviousPage={handlePreviousJobsPage}
                onNextPage={handleNextJobsPage}
                onSelectJob={handleSelectJob}
                onDeleteJob={handleDeleteJob}
              />
            </section>
          </div>

          <ResultsTable
            channel={activeJob?.channel ?? null}
            results={results}
            loading={resultsLoading}
            sortBy={resultSortBy}
            page={resultPage}
            totalPages={resultTotalPages}
            total={resultTotal}
            hasPreviousPage={hasPreviousResultsPage}
            hasNextPage={hasNextResultsPage}
            onSortChange={handleResultSortChange}
            onPreviousPage={handlePreviousResultsPage}
            onNextPage={handleNextResultsPage}
          />
        </div>
      </div>
      {jobPendingDelete && (
        <DeleteConfirmModal
          job={jobPendingDelete}
          deleting={deleteLoading}
          onCancel={() => {
            if (!deleteLoading) {
              setJobPendingDelete(null);
            }
          }}
          onConfirm={confirmDeleteJob}
        />
      )}
    </main>
  );
}