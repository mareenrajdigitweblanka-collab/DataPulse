"use client";

import type { ResultRow } from "@/lib/types";
import { EMPTY, TD, TH, ResultImageCell, ResultLinkCell } from "./shared";

type ShopifyData = {
  title?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  isAvailable?: boolean | null;
  productType?: string | null;
  vendor?: string | null;
  variantCount?: number | null;
  handle?: string | null;
  productUrl?: string | null;
};

function getShopifyData(row: ResultRow): ShopifyData {
  if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
    return row.data as ShopifyData;
  }
  return {};
}

const COLUMNS = [
  "#",
  "Image",
  "Title",
  "Price",
  "Available",
  "Type",
  "Vendor",
  "Variants",
  "Handle",
  "Link",
];

export function ShopifyResultsTable({ results }: { results: ResultRow[] }) {
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
          const d = getShopifyData(row);
          const price =
            typeof d.price === "number" && Number.isFinite(d.price)
              ? d.price.toFixed(2)
              : EMPTY;

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
                {price}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {d.isAvailable === true
                  ? "Yes"
                  : d.isAvailable === false
                    ? "No"
                    : EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {d.productType?.trim() || EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {d.vendor?.trim() || EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {typeof d.variantCount === "number" ? d.variantCount : EMPTY}
              </td>

              <td
                className={`${TD} text-xs font-mono`}
                style={{ color: "var(--text-tertiary)" }}
              >
                {d.handle?.trim() || EMPTY}
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
