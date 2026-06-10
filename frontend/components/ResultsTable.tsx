"use client";

import type { ResultRow, ResultsSortBy } from "@/lib/types";
import { EmptyBox } from "./ui";

type ResultData = Record<string, unknown>;

function getDisplayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim() === "" ? "—" : value;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? `${value.length} items` : "—";
  }

  if (typeof value === "object") {
    return "View details";
  }

  return String(value);
}

function getResultData(row: ResultRow): ResultData {
  if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
    return row.data as ResultData;
  }

  return {};
}

function getString(data: ResultData, keys: string[]) {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return null;
}

function getNumber(data: ResultData, keys: string[]) {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function getBoolean(data: ResultData, keys: string[]) {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
}

function getTitle(row: ResultRow) {
  const data = getResultData(row);

  return (
    getString(data, ["title", "name", "productTitle", "product_title"]) ??
    "Untitled result"
  );
}

function getPrice(row: ResultRow) {
  const data = getResultData(row);

  return getNumber(data, ["price", "minPrice", "min_price"]);
}

function getImageUrl(row: ResultRow) {
  const data = getResultData(row);

  return getString(data, [
    "imageUrl",
    "image_url",
    "main_image_url",
    "thumbnail",
    "thumbnailUrl",
  ]);
}

function getProductUrl(row: ResultRow) {
  const data = getResultData(row);

  return getString(data, [
    // Common / Google / Shopify
    "productUrl",
    "product_url",

    // eBay
    "itemUrl",
    "itemWebUrl",

    // Google fallback
    "storeUrl",

    // Other fallbacks
    "url",
    "listingUrl",
    "listing_url",
  ]);
}

function getVendorOrSeller(row: ResultRow) {
  const data = getResultData(row);

  return getString(data, [
    // Shopify
    "vendor",

    // eBay
    "sellerUsername",
    "seller",

    // Google Shopping
    "storeName",
    "source",
    "store",

    // Amazon / common
    "brand",
    "sellerName",
    "merchant",
    "ASIN",
    "asin",
  ]);
}

function getTypeOrCondition(row: ResultRow) {
  const data = getResultData(row);

  const directValue = getString(data, [
    // Shopify
    "productType",
    "product_type",

    // eBay
    "condition",

    // Common
    "category",
    "categoryName",
    "category_name",
  ]);

  if (directValue) return directValue;

  /**
   * Amazon-specific display.
   *
   * Amazon result sample has:
   * ASIN, isPrime, isAvailable, rating, reviewCount.
   *
   * Show Prime/stock status before rating because it is more useful
   * in the Type / Condition column.
   */
  const asin = getString(data, ["ASIN", "asin"]);
  const isPrime = getBoolean(data, ["isPrime", "primeEligible"]);

  if (asin && isPrime === true) {
    return "Prime eligible";
  }

  if (asin && isPrime === false) {
    return "Non-Prime";
  }

  /**
   * Stock / availability display.
   *
   * Works for Amazon/eBay/Google/common channels.
   */
  const isInStock = getBoolean(data, ["isInStock", "inStock", "isAvailable"]);

  if (isInStock === true) return "In stock";
  if (isInStock === false) return "Out of stock";

  /**
   * Google Shopping delivery/shipping display.
   */
  const delivery = getString(data, ["delivery", "shippingText", "shipping"]);

  if (delivery) return delivery;

  /**
   * Rating/review display.
   *
   * Amazon uses reviewCount.
   * Google uses reviews.
   */
  const rating = getNumber(data, ["rating", "starRating"]);
  const reviews = getNumber(data, ["reviews", "reviewCount", "review_count"]);

  if (rating !== null && reviews !== null) {
    return `${rating}★ / ${reviews} reviews`;
  }

  if (rating !== null) {
    return `${rating}★`;
  }

  /**
   * eBay shipping fallback.
   */
  const isFreeShipping = getBoolean(data, ["isFreeShipping", "freeShipping"]);

  if (isFreeShipping === true) return "Free shipping";

  return null;
}

function formatPrice(row: ResultRow) {
  const data = getResultData(row);
  const price = getPrice(row);

  if (price === null) return "—";

  const currency = getString(data, ["currency"]);

  if (currency) {
    return `${currency} ${price}`;
  }

  return String(price);
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
                    const imageUrl = getImageUrl(row);
                    const productUrl = getProductUrl(row);
                    const vendor = getVendorOrSeller(row);
                    const typeOrCondition = getTypeOrCondition(row);

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
                              alt={getTitle(row)}
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
                          {formatPrice(row)}
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