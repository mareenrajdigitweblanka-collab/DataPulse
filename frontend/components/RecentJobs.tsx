"use client";

import type { Job } from "@/lib/types";
import { EmptyBox, StatusBadge } from "./ui";

function canDeleteJob(status: Job["status"]) {
  return status === "done" || status === "error" || status === "timeout";
}

export function RecentJobs({
  jobs,
  page,
  totalPages,
  total,
  hasPreviousPage,
  hasNextPage,
  activeJobId,
  deletingJobId,
  onRefresh,
  onPreviousPage,
  onNextPage,
  onSelectJob,
  onDeleteJob,
}: {
  jobs: Job[];
  page: number;
  totalPages: number;
  total: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  activeJobId?: string | null;
  deletingJobId?: string | null;
  onRefresh: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onSelectJob: (job: Job) => void;
  onDeleteJob: (job: Job) => void;
}) {
  return (
    <section className="card p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Recent Jobs
          </h2>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Select a previous job to reload status and results.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 active:translate-y-0"
          style={{
            borderColor: "var(--border-secondary)",
            color: "var(--text-secondary)",
            background: "var(--bg-secondary)",
          }}
        >
          Refresh
        </button>
      </div>

      <div className="mt-5">
        {jobs.length === 0 ? (
          <EmptyBox message="No jobs yet." />
        ) : (
          <>
            <div
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <div
                className="divide-y"
                style={{ borderColor: "var(--border-primary)" }}
              >
                {jobs.map((job) => {
                  const deletable = canDeleteJob(job.status);
                  const isActive = activeJobId === job.id;
                  const isDeleting = deletingJobId === job.id;

                  return (
                    <div
                      key={job.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectJob(job)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectJob(job);
                        }
                      }}
                      className={[
                        "group relative block w-full cursor-pointer px-4 py-3 text-left transition-all duration-200",
                        "hover:-translate-y-[1px] hover:shadow-md",
                        isActive ? "ring-1" : "",
                        isDeleting ? "pointer-events-none opacity-60" : "",
                      ].join(" ")}
                      style={{
                        background: isActive
                          ? "color-mix(in srgb, var(--accent-primary) 14%, var(--bg-secondary))"
                          : "var(--bg-secondary)",
                        boxShadow: isActive
                          ? "0 0 0 1px color-mix(in srgb, var(--accent-primary) 45%, transparent)"
                          : undefined,
                        borderColor: isActive
                          ? "var(--accent-primary)"
                          : "transparent",
                      }}
                    >
                      {isActive && (
                        <div
                          className="absolute left-0 top-0 h-full w-1"
                          style={{ background: "var(--accent-primary)" }}
                        />
                      )}

                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 pl-1">
                          <div className="flex items-center gap-2">
                            <p
                              className="font-semibold transition-colors duration-200"
                              style={{
                                color: isActive
                                  ? "var(--accent-primary)"
                                  : "var(--text-primary)",
                              }}
                            >
                              {job.channel.toUpperCase()} —{" "}
                              {job.query || "(empty query)"}
                            </p>

                            {isActive && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                                style={{
                                  background:
                                    "color-mix(in srgb, var(--accent-primary) 18%, transparent)",
                                  color: "var(--accent-primary)",
                                }}
                              >
                                Selected
                              </span>
                            )}
                          </div>

                          <p
                            className="mt-1 break-all text-xs"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {job.id}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <StatusBadge status={job.status} />

                          <button
                            type="button"
                            disabled={!deletable || isDeleting}
                            title={
                              deletable
                                ? "Delete job"
                                : "Only finished jobs can be deleted"
                            }
                            onClick={(event) => {
                              event.stopPropagation();

                              if (!deletable || isDeleting) return;

                              onDeleteJob(job);
                            }}
                            className="rounded-lg border px-2 py-1 text-xs font-semibold transition-all duration-200 hover:scale-105 hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                            style={{
                              borderColor:
                                "color-mix(in srgb, var(--error) 35%, transparent)",
                              color: "var(--error)",
                              background: "var(--error-soft)",
                            }}
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <p
                className="text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                Page {page} of {totalPages} · {total} jobs
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onPreviousPage}
                  disabled={!hasPreviousPage}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: "var(--border-secondary)",
                    color: "var(--text-secondary)",
                    background: "var(--bg-secondary)",
                  }}
                >
                  ← Previous
                </button>

                <button
                  type="button"
                  onClick={onNextPage}
                  disabled={!hasNextPage}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: "var(--border-secondary)",
                    color: "var(--text-secondary)",
                    background: "var(--bg-secondary)",
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}