"use client";

import type { ResultRow } from "@/lib/types";
import { EMPTY, TD, TH, ResultImageCell, ResultLinkCell } from "./shared";

type ResultData = Record<string, unknown>;

function getResultData(row: ResultRow): ResultData {
  if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
    return row.data as ResultData;
  }
  return {};
}

function getString(data: ResultData, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

function getNumber(data: ResultData, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function getBoolean(data: ResultData, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "boolean") return value;
  }
  return null;
}

function getTitle(row: ResultRow) {
  return (
    getString(getResultData(row), ["title", "name"]) ?? "Untitled result"
  );
}

function getPrice(row: ResultRow) {
  return getNumber(getResultData(row), ["price", "minPrice"]);
}

function getImageUrl(row: ResultRow) {
  return getString(getResultData(row), [
    "imageUrl",
    "image_url",
    "thumbnail",
  ]);
}

function getProductUrl(row: ResultRow) {
  return getString(getResultData(row), [
    "productUrl",
    "itemUrl",
    "storeUrl",
    "url",
  ]);
}

function getVendor(row: ResultRow) {
  return getString(getResultData(row), [
    "vendor",
    "sellerUsername",
    "storeName",
    "brand",
  ]);
}

function formatPrice(row: ResultRow) {
  const price = getPrice(row);
  if (price === null) return EMPTY;
  const currency = getString(getResultData(row), ["currency"]);
  return currency ? `${currency} ${price.toFixed(2)}` : price.toFixed(2);
}

function getTypeOrCondition(row: ResultRow) {
  const data = getResultData(row);

  const direct = getString(data, ["productType", "condition", "category"]);
  if (direct) return direct;

  const isInStock = getBoolean(data, ["isInStock", "isAvailable"]);
  if (isInStock === true) return "In stock";
  if (isInStock === false) return "Out of stock";

  const rating = getNumber(data, ["rating"]);
  const reviews = getNumber(data, ["reviews", "reviewCount"]);
  if (rating !== null && reviews !== null) return `${rating}★ / ${reviews} reviews`;
  if (rating !== null) return `${rating}★`;

  return null;
}

const COLUMNS = ["#", "Image", "Product", "Price", "Vendor / Seller", "Type / Condition", "Link"];

export function GenericResultsTable({ results }: { results: ResultRow[] }) {
  return (
    <table className="min-w-full text-left text-sm">
      <thead style={{ background: "var(--bg-secondary)" }}>
        <tr>
          {COLUMNS.map((col) => (
            <th key={col} className={TH} style={{ color: "var(--text-secondary)" }}>
              {col}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y" style={{ borderColor: "var(--border-primary)" }}>
        {results.map((row) => {
          const vendor = getVendor(row);
          const typeOrCondition = getTypeOrCondition(row);

          return (
            <tr key={row.id} style={{ background: "var(--bg-secondary)" }}>
              <td className={`${TD} text-xs`} style={{ color: "var(--text-tertiary)" }}>
                {row.position}
              </td>

              <td className={TD}>
                <ResultImageCell src={getImageUrl(row)} alt={getTitle(row)} />
              </td>

              <td className={`max-w-xs ${TD} font-semibold`} style={{ color: "var(--text-primary)" }}>
                <span className="line-clamp-2">{getTitle(row)}</span>
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {formatPrice(row)}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {vendor ?? EMPTY}
              </td>

              <td className={TD} style={{ color: "var(--text-secondary)" }}>
                {typeOrCondition ?? EMPTY}
              </td>

              <td className={TD}>
                <ResultLinkCell href={getProductUrl(row)} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
