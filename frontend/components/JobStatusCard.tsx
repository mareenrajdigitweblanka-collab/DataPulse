"use client";

import type { Job } from "@/lib/types";
import { Metric, StatusBadge } from "./ui";

export function JobStatusCard({
  job,
  loadingResults,
  onLoadResults,
}: {
  job: Job;
  loadingResults: boolean;
  onLoadResults: () => void;
}) {
  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Active Job
          </h2>
          <p
            className="mt-1 break-all text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {job.id}
          </p>
        </div>

        <StatusBadge status={job.status} />
      </div>

      <div className="mt-5">
        <div
          className="mb-2 flex justify-between text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>Progress</span>
          <span>{job.progressPercent}%</span>
        </div>

        <div
          className="h-3 overflow-hidden rounded-full"
          style={{ background: "var(--bg-tertiary)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(Math.max(job.progressPercent, 0), 100)}%`,
              background: "var(--gradient-brand)",
            }}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Metric label="Channel" value={job.channel.toUpperCase()} />
        <Metric label="Status" value={job.status} />
        <Metric label="Scraped" value={job.totalScraped ?? "-"} />
        <Metric label="Filtered" value={job.totalFiltered ?? "-"} />
      </div>

      {job.errorMessage && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            background: "var(--error-soft)",
            color: "var(--error)",
            border: "1px solid",
            borderColor: "color-mix(in srgb, var(--error) 20%, transparent)",
          }}
        >
          {job.errorMessage}
        </div>
      )}

      {job.status === "done" && (
        <button
          type="button"
          onClick={onLoadResults}
          disabled={loadingResults}
          className="mt-5 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
          style={{
            background: "var(--gradient-brand)",
          }}
        >
          {loadingResults ? (
            <>
              <span className="spinner" style={{ borderTopColor: "white", borderColor: "rgba(255,255,255,0.3)" }} />
              Loading results...
            </>
          ) : (
            "Load Results"
          )}
        </button>
      )}
    </section>
  );
}