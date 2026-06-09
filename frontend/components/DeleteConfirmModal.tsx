"use client";

import type { Job } from "@/lib/types";

export function DeleteConfirmModal({
    job,
    deleting,
    onCancel,
    onConfirm,
}: {
    job: Job;
    deleting: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
                className="absolute inset-0 backdrop-blur-sm"
                style={{ background: "rgba(0, 0, 0, 0.65)" }}
                onClick={deleting ? undefined : onCancel}
            />

            <div
                className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl animate-fade-in"
                style={{
                    background: "var(--bg-secondary)",
                    borderColor: "var(--border-primary)",
                }}
            >
                <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ background: "var(--error-soft)" }}
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--error)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                    </svg>
                </div>

                <h2
                    className="text-xl font-bold"
                    style={{ color: "var(--text-primary)" }}
                >
                    Delete this job?
                </h2>

                <p
                    className="mt-2 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                >
                    This action will permanently delete the job and its saved results.
                </p>

                <div
                    className="mt-4 rounded-xl border p-4"
                    style={{
                        background: "var(--bg-primary)",
                        borderColor: "var(--border-primary)",
                    }}
                >
                    <p
                        className="font-semibold"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {job.channel.toUpperCase()} — {job.query || "(empty query)"}
                    </p>

                    <p
                        className="mt-1 break-all text-xs"
                        style={{ color: "var(--text-tertiary)" }}
                    >
                        {job.id}
                    </p>

                    <p
                        className="mt-2 text-xs"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Status: <span className="font-semibold">{job.status}</span>
                    </p>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={deleting}
                        className="rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                            borderColor: "var(--border-secondary)",
                            color: "var(--text-secondary)",
                            background: "var(--bg-secondary)",
                        }}
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={deleting}
                        className="rounded-xl px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ background: "var(--error)" }}
                    >
                        {deleting ? "Deleting..." : "Delete job"}
                    </button>
                </div>
            </div>
        </div>
    );
}