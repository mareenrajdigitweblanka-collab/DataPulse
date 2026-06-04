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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Recent Jobs</h2>
          <p className="mt-1 text-sm text-slate-500">
            Select a previous job to reload status and results.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="mt-5">
        {jobs.length === 0 ? (
          <EmptyBox message="No jobs yet." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="divide-y divide-slate-200">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => onSelectJob(job)}
                  className="block w-full bg-white px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {job.channel.toUpperCase()} —{" "}
                        {job.query || "(empty query)"}
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-500">
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