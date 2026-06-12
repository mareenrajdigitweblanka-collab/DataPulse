"use client";

import type { ResultRow } from "@/lib/types";
import { EMPTY, TD, TH, formatPrice, ResultImageCell, ResultLinkCell } from "./shared";

function formatReviewCount(count: number | null | undefined): string {
  if (count == null || !Number.isFinite(count)) return EMPTY;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

type AmazonData = {
  title?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  currency?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  isPrime?: boolean | null;
  isSponsored?: boolean | null;
  isAvailable?: boolean | null;
  productUrl?: string | null;
  ASIN?: string | null;
};

function getAmazonData(row: ResultRow): AmazonData {
  if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
    return row.data as AmazonData;
  }
  return {};
}

const COLUMNS = [
  "#",
  "Image",
  "Title",
  "ASIN",
  "Price",
  "Rating",
  "Reviews",
  "Prime",
  "Sponsored",
  "Available",
  "Link",
];

export function AmazonResultsTable({ results }: { results: ResultRow[] }) {
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
          const d = getAmazonData(row);

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
                <span className="line-clamp-2">{d.title?.trim() || EMPTY}</span>
              </td>

              <td
                className={`${TD} font-mono text-xs`}
                style={{ color: "var(--text-tertiary)" }}
              >
                {d.ASIN || EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {formatPrice(d.price, d.currency)}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {d.rating != null ? d.rating.toFixed(1) : EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {formatReviewCount(d.reviewCount)}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {d.isPrime === true ? "Yes" : d.isPrime === false ? "No" : EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {d.isSponsored === true ? "Yes" : d.isSponsored === false ? "No" : EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {d.isAvailable === true ? "Yes" : d.isAvailable === false ? "No" : EMPTY}
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
