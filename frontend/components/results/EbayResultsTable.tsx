"use client";

import type { ResultRow } from "@/lib/types";
import { EMPTY, TD, TH, formatPrice, ResultImageCell, ResultLinkCell } from "./shared";

type EbayData = {
  title?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  currency?: string | null;
  condition?: string | null;
  isAvailable?: boolean | null;
  isFreeShipping?: boolean | null;
  shippingCost?: number | null;
  listingType?: string | null;
  sellerUsername?: string | null;
  itemId?: string | null;
  itemUrl?: string | null;
};

function getEbayData(row: ResultRow): EbayData {
  if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
    return row.data as EbayData;
  }
  return {};
}

const COLUMNS = [
  "#",
  "Image",
  "Title",
  "Price",
  "Condition",
  "Available",
  "Shipping",
  "Listing",
  "Seller",
  "Item ID",
  "Link",
];

export function EbayResultsTable({ results }: { results: ResultRow[] }) {
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
          const d = getEbayData(row);

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
                {d.condition?.trim() || EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {d.isAvailable === true
                  ? "Yes"
                  : d.isAvailable === false
                    ? "No"
                    : EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {d.isFreeShipping === true
                  ? "Free"
                  : typeof d.shippingCost === "number" && d.shippingCost > 0
                    ? formatPrice(d.shippingCost, d.currency)
                    : d.isFreeShipping === false
                      ? "Paid"
                      : EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {d.listingType?.trim() || EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {d.sellerUsername?.trim() || EMPTY}
              </td>

              <td
                className={`${TD} text-xs font-mono`}
                style={{ color: "var(--text-tertiary)" }}
              >
                {d.itemId?.trim() || EMPTY}
              </td>

              <td className={TD}>
                <ResultLinkCell href={d.itemUrl} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
