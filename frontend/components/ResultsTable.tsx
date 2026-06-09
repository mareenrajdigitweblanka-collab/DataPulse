"use client";

import type { ResultRow, ResultsSortBy } from "@/lib/types";
import { EmptyBox } from "./ui";

function getDisplayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? `${value.length} items` : "—";
  }

  if (typeof value === "object") {
    return "View details";
  }

  return String(value);
}

function getResultData(row: ResultRow) {
  return row.data ?? {};
}

function getTitle(row: ResultRow) {
  const data = getResultData(row);

  return (
    (typeof data.title === "string" && data.title) ||
    (typeof data.name === "string" && data.name) ||
    (typeof data.productTitle === "string" && data.productTitle) ||
    "Untitled result"
  );
}

function getPrice(row: ResultRow) {
  const data = getResultData(row);

  if (typeof data.price === "number") return data.price;
  if (typeof data.minPrice === "number") return data.minPrice;

  return null;
}

function getImageUrl(row: ResultRow) {
  const data = getResultData(row);

  if (typeof data.imageUrl === "string") return data.imageUrl;
  if (typeof data.image_url === "string") return data.image_url;
  if (typeof data.main_image_url === "string") return data.main_image_url;

  return null;
}

function getProductUrl(row: ResultRow) {
  const data = getResultData(row);

  if (typeof data.productUrl === "string") return data.productUrl;
  if (typeof data.url === "string") return data.url;
  if (typeof data.listingUrl === "string") return data.listingUrl;
  if (typeof data.listing_url === "string") return data.listing_url;

  return null;
}

export function ResultsTable({
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
            Page {page} of {totalPages} · {total} results
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
              <table className="min-w-full text-left text-sm">
                <thead style={{ background: "var(--bg-secondary)" }}>
                  <tr>
                    <th
                      className="px-4 py-3 font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      #
                    </th>
                    <th
                      className="px-4 py-3 font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Image
                    </th>
                    <th
                      className="px-4 py-3 font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Product
                    </th>
                    <th
                      className="px-4 py-3 font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Price
                    </th>
                    <th
                      className="px-4 py-3 font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Vendor / Seller
                    </th>
                    <th
                      className="px-4 py-3 font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Type / Condition
                    </th>
                    <th
                      className="px-4 py-3 font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Link
                    </th>
                  </tr>
                </thead>

                <tbody
                  className="divide-y"
                  style={{ borderColor: "var(--border-primary)" }}
                >
                  {results.map((row) => {
                    const data = getResultData(row);
                    const imageUrl = getImageUrl(row);
                    const productUrl = getProductUrl(row);
                    const price = getPrice(row);

                    const vendor =
                      data.vendor ??
                      data.seller ??
                      data.sellerUsername ??
                      data.brand ??
                      null;

                    const typeOrCondition =
                      data.productType ??
                      data.condition ??
                      data.category ??
                      null;

                    return (
                      <tr
                        key={row.id}
                        style={{ background: "var(--bg-secondary)" }}
                      >
                        <td
                          className="px-4 py-3 align-top text-xs"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {row.position}
                        </td>

                        <td className="px-4 py-3 align-top">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl}
                              alt=""
                              className="h-12 w-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-12 w-12 items-center justify-center rounded-lg text-xs"
                              style={{
                                background: "var(--bg-primary)",
                                color: "var(--text-tertiary)",
                              }}
                            >
                              —
                            </div>
                          )}
                        </td>

                        <td
                          className="max-w-xs px-4 py-3 align-top font-semibold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          <span className="line-clamp-2">{getTitle(row)}</span>
                        </td>

                        <td
                          className="px-4 py-3 align-top"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {price === null ? "—" : price}
                        </td>

                        <td
                          className="px-4 py-3 align-top"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {getDisplayValue(vendor)}
                        </td>

                        <td
                          className="px-4 py-3 align-top"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {getDisplayValue(typeOrCondition)}
                        </td>

                        <td className="px-4 py-3 align-top">
                          {productUrl ? (
                            <a
                              href={productUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-semibold hover:opacity-80"
                              style={{ color: "var(--accent-primary)" }}
                            >
                              Open
                            </a>
                          ) : (
                            <span style={{ color: "var(--text-tertiary)" }}>
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
              Showing page {page} of {totalPages} · {total} results
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