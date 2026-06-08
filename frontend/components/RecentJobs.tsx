"use client";

import type { Job } from "@/lib/types";
import { EmptyBox, StatusBadge } from "./ui";

export function RecentJobs({
  jobs,
  onRefresh,
  onSelectJob,
}: {
  jobs: Job[];
  onRefresh: () => void;
  onSelectJob: (job: Job) => void;
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
          className="rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:opacity-85"
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
          <div
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: "var(--border-primary)" }}
          >
            <div
              className="divide-y"
              style={{ borderColor: "var(--border-primary)" }}
            >
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => onSelectJob(job)}
                  className="block w-full px-4 py-3 text-left transition-colors duration-200 hover:bg-[var(--bg-hover)]"
                  style={{
                    background: "var(--bg-secondary)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p
                        className="font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {job.channel.toUpperCase()} —{" "}
                        {job.query || "(empty query)"}
                      </p>
                      <p
                        className="mt-1 break-all text-xs"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {job.id}
                      </p>
                    </div>

                    <StatusBadge status={job.status} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}