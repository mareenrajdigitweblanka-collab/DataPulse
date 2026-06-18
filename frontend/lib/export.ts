import { api } from "./api";
import type { Channel, ResultRow } from "./types";

type CsvRow = Record<string, string | number | boolean | null | undefined>;

type ChannelCsvExporter = (rows: ResultRow[]) => CsvRow[];

function serializeCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headerLine = headers.map(escape).join(",");
  const dataLines = rows.map((row) => headers.map((h) => escape(row[h])).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}

function triggerCsvDownload(csvString: string, filename: string): void {
  const blob = new Blob(["﻿" + csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function getAllResults(token: string, jobId: string): Promise<ResultRow[]> {
  const all: ResultRow[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const response = await api.getResults(token, jobId, page, 100, "position");
    all.push(...response.data.results);
    hasNext = response.data.hasNextPage;
    page++;
  }
  return all;
}

function shopifyToCsvRows(rows: ResultRow[]): CsvRow[] {
  return rows.map((row) => {
    const d = row.data as Record<string, unknown>;
    const tags = Array.isArray(d.tags) ? (d.tags as string[]).join("; ") : "";
    const available =
      d.isAvailable == null ? "" : d.isAvailable ? "Yes" : "No";
    return {
      Position: row.position,
      Title: d.title as string | null,
      Vendor: d.vendor as string | null,
      "Product Type": d.productType as string | null,
      Price: d.price as number | null,
      "Min Price": d.minPrice as number | null,
      "Max Price": d.maxPrice as number | null,
      Available: available,
      "Variant Count": d.variantCount as number | null,
      "Available Variants": d.availableVariantCount as number | null,
      "SKU Count": d.skuCount as number | null,
      Tags: tags,
      "Published At": d.publishedAt as string | null,
      URL: sanitizeUrl(d.productUrl),
      "Image URL": sanitizeUrl(d.imageUrl),
    };
  });
}

function sanitizeUrl(v: unknown): string | null {
  if (v == null || typeof v !== "string") return null;
  return v.replace(/ /g, "%20");
}

function parseCount(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const s = v.trim().toUpperCase().replace(/,/g, "");
    if (s.endsWith("K")) return Math.round(parseFloat(s) * 1_000);
    if (s.endsWith("M")) return Math.round(parseFloat(s) * 1_000_000);
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  return null;
}

function amazonToCsvRows(rows: ResultRow[]): CsvRow[] {
  return rows.map((row) => {
    const d = row.data as Record<string, unknown>;
    const available =
      d.isAvailable == null ? "" : d.isAvailable ? "Yes" : "No";
    return {
      Position: row.position,
      ASIN: d.ASIN as string | null,
      Title: d.title as string | null,
      Price: d.price as number | null,
      Currency: d.currency as string | null,
      Rating: d.rating as number | null,
      "Review Count": parseCount(d.reviewCount),
      Available: available,
      URL: sanitizeUrl(d.productUrl),
      "Image URL": sanitizeUrl(d.imageUrl),
    };
  });
}

function ebayToCsvRows(rows: ResultRow[]): CsvRow[] {
  return rows.map((row) => {
    const d = row.data as Record<string, unknown>;
    const available =
      d.isAvailable == null ? "" : d.isAvailable ? "Yes" : "No";
    const shipping =
      d.isFreeShipping == null ? "" : d.isFreeShipping ? "Free" : "Paid";
    return {
      Position: row.position,
      Title: d.title as string | null,
      Price: d.price as number | null,
      Currency: d.currency as string | null,
      Condition: d.condition as string | null,
      Available: available,
      Shipping: shipping,
      Seller: d.sellerUsername as string | null,
      URL: sanitizeUrl(d.itemUrl),
      "Image URL": sanitizeUrl(d.imageUrl),
    };
  });
}

function googleToCsvRows(rows: ResultRow[]): CsvRow[] {
  return rows.map((row) => {
    const d = row.data as Record<string, unknown>;
    return {
      Position: row.position,
      Title: d.title as string | null,
      Store: d.storeName as string | null,
      Price: d.price as number | null,
      Currency: d.currency as string | null,
      Rating: d.rating as number | null,
      Reviews: d.reviews as number | null,
      URL: sanitizeUrl(d.productUrl),
      "Image URL": sanitizeUrl(d.imageUrl),
    };
  });
}

const CSV_EXPORTERS: Partial<Record<Channel, ChannelCsvExporter>> = {
  shopify: shopifyToCsvRows,
  amazon: amazonToCsvRows,
  ebay: ebayToCsvRows,
  google: googleToCsvRows,
};

export async function exportToCsv(
  token: string,
  jobId: string,
  channel: Channel
): Promise<void> {
  const exporter = CSV_EXPORTERS[channel];
  if (!exporter) {
    throw new Error(`CSV export is not yet supported for channel: ${channel}`);
  }
  const rows = await getAllResults(token, jobId);
  const csvRows = exporter(rows);
  const csv = serializeCsv(csvRows);
  triggerCsvDownload(csv, `datapulse-${channel}-${jobId}.csv`);
}
