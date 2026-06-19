"use client";

import type { ResultRow } from "@/lib/types";
import { EMPTY, TD, TH, formatPrice, ResultImageCell, ResultLinkCell } from "./shared";

type GoogleData = {
  title?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  currency?: string | null;
  rating?: number | null;
  reviews?: number | null;
  storeName?: string | null;
  storeUrl?: string | null;
  productUrl?: string | null;
};

function getGoogleData(row: ResultRow): GoogleData {
  if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
    return row.data as GoogleData;
  }
  return {};
}

const COLUMNS = [
  "#",
  "Image",
  "Title",
  "Price",
  "Rating",
  "Reviews",
  "Store",
  "Link",
];

export function GoogleResultsTable({ results }: { results: ResultRow[] }) {
  return (
    <table className="min-w-full text-left text-sm">
      <thead style={{ background: "var(--bg-secondary)" }}>
        <tr>
          {COLUMNS.map((col) => (
            <th
              key={col}
              className={TH}
              style={{ color: "var(--text-secondary)" }}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y" style={{ borderColor: "var(--border-primary)" }}>
        {results.map((row) => {
          const d = getGoogleData(row);
          const rating =
            typeof d.rating === "number" && Number.isFinite(d.rating)
              ? d.rating
              : null;
          const reviews =
            typeof d.reviews === "number" && Number.isFinite(d.reviews)
              ? d.reviews
              : null;

          return (
            <tr key={row.id} style={{ background: "var(--bg-secondary)" }}>
              <td
                className={`${TD} text-xs`}
                style={{ color: "var(--text-tertiary)" }}
              >
                {row.position}
              </td>

              <td className={TD}>
                <ResultImageCell src={d.imageUrl} alt={d.title ?? ""} />
              </td>

              <td
                className={`max-w-xs ${TD} font-semibold`}
                style={{ color: "var(--text-primary)" }}
              >
                <span className="line-clamp-2">
                  {d.title?.trim() || EMPTY}
                </span>
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {formatPrice(d.price, d.currency)}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {rating !== null ? `${rating}★` : EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {reviews !== null ? reviews.toLocaleString() : EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {d.storeUrl ? (
                  <a
                    href={d.storeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:opacity-80"
                    style={{ color: "var(--accent-primary)" }}
                  >
                    {d.storeName?.trim() || d.storeUrl}
                  </a>
                ) : (
                  d.storeName?.trim() || EMPTY
                )}
              </td>

              <td className={TD}>
                <ResultLinkCell href={d.productUrl} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
