"use client";

import type { Channel, ResultRow, ResultsSortBy } from "@/lib/types";
import { EmptyBox } from "./ui";
import { ShopifyResultsTable } from "./results/ShopifyResultsTable";
import { EbayResultsTable } from "./results/EbayResultsTable";
import { GoogleResultsTable } from "./results/GoogleResultsTable";
import { AmazonResultsTable } from "./results/AmazonResultsTable";
import { GenericResultsTable } from "./results/GenericResultsTable";

function PlatformTable({
  channel,
  results,
}: {
  channel: Channel | null;
  results: ResultRow[];
}) {
  if (channel === "shopify") return <ShopifyResultsTable results={results} />;
  if (channel === "ebay") return <EbayResultsTable results={results} />;
  if (channel === "google") return <GoogleResultsTable results={results} />;
  if (channel === "amazon") return <AmazonResultsTable results={results} />;

  return <GenericResultsTable results={results} />;
}

export function ResultsTable({
  channel,
  results,
  loading,
  sortBy,
  page,
  totalPages,
  total,
  hasPreviousPage,
  hasNextPage,
  onSortChange,
  onPreviousPage,
  onNextPage,
}: {
  channel: Channel | null;
  results: ResultRow[];
  loading: boolean;
  sortBy: ResultsSortBy;
  page: number;
  totalPages: number;
  total: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onSortChange: (sortBy: ResultsSortBy) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  const safeTotalPages = Math.max(totalPages, 1);

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Results
          </h2>

          <p
            className="mt-1 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Page {page} of {safeTotalPages} · {total} results
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label
            className="text-sm font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Sort by
          </label>

          <select
            value={sortBy}
            onChange={(event) =>
              onSortChange(event.target.value as ResultsSortBy)
            }
            className="rounded-lg border px-3 py-2 text-sm font-semibold outline-none"
            style={{
              borderColor: "var(--border-secondary)",
              color: "var(--text-primary)",
              background: "var(--bg-secondary)",
            }}
          >
            <option value="position">Original position</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            {(channel === "google" || channel === "amazon") && (
              <>
                <option value="rating_desc">Rating: high to low</option>
                <option value="reviews_desc">Reviews: high to low</option>
              </>
            )}
          </select>
        </div>
      </div>

      {loading ? (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-6"
          style={{
            borderColor: "var(--border-primary)",
            background: "var(--bg-secondary)",
          }}
        >
          <span className="spinner" />
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Loading results...
          </span>
        </div>
      ) : results.length === 0 ? (
        <EmptyBox message="No results loaded yet." />
      ) : (
        <>
          <div
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: "var(--border-primary)" }}
          >
            <div className="overflow-x-auto">
              <PlatformTable channel={channel} results={results} />
            </div>
          </div>

          <div
            className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--border-primary)" }}
          >
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Showing page {page} of {safeTotalPages} · {total} results
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPreviousPage}
                disabled={!hasPreviousPage}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
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
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
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
    </section>
  );
}
