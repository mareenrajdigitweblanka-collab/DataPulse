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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Active Job</h2>
          <p className="mt-1 break-all text-sm text-slate-500">{job.id}</p>
        </div>

        <StatusBadge status={job.status} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex justify-between text-sm text-slate-600">
          <span>Progress</span>
          <span>{job.progressPercent}%</span>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-700 transition-all"
            style={{
              width: `${Math.min(Math.max(job.progressPercent, 0), 100)}%`,
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
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {job.errorMessage}
        </div>
      )}

      {job.status === "done" && (
        <button
          type="button"
          onClick={onLoadResults}
          disabled={loadingResults}
          className="mt-5 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
        >
          {loadingResults ? "Loading results..." : "Load Results"}
        </button>
      )}
    </section>
  );
}