"use client";

import type { ResultRow } from "@/lib/types";
import { EmptyBox } from "./ui";

function readValue(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];

    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }

  return "-";
}

function readImage(data: Record<string, unknown>) {
  const value =
    data.imageUrl ||
    data.image_url ||
    data.thumbnail ||
    data.thumbnailUrl ||
    data.main_image_url ||
    data.image;

  return typeof value === "string" ? value : "";
}

function readUrl(data: Record<string, unknown>) {
  return readValue(data, ["url", "link", "productUrl", "product_url"]);
}

export function ResultsTable({
  results,
  loading,
}: {
  results: ResultRow[];
  loading: boolean;
}) {
  return (
    <section className="card p-6">
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
          Generic table for Shopify, eBay, Google Shopping, and Amazon results.
        </p>
      </div>

      <div
        className="mt-5 overflow-x-auto rounded-xl border"
        style={{ borderColor: "var(--border-primary)" }}
      >
        {loading ? (
          <div
            className="p-6 text-center text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Loading results...
          </div>
        ) : results.length === 0 ? (
          <div className="p-6">
            <EmptyBox message="No results loaded yet." />
          </div>
        ) : (
          <table
            className="min-w-full divide-y text-sm"
            style={{ borderColor: "var(--border-primary)" }}
          >
            <thead style={{ background: "var(--bg-tertiary)" }}>
              <tr>
                <th
                  className="px-4 py-3 text-left font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  #
                </th>
                <th
                  className="px-4 py-3 text-left font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Image
                </th>
                <th
                  className="px-4 py-3 text-left font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Title
                </th>
                <th
                  className="px-4 py-3 text-left font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Price
                </th>
                <th
                  className="px-4 py-3 text-left font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Source
                </th>
                <th
                  className="px-4 py-3 text-left font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  URL
                </th>
              </tr>
            </thead>

            <tbody
              className="divide-y"
              style={{
                borderColor: "var(--border-primary)",
                background: "var(--bg-secondary)",
              }}
            >
              {results.map((row) => {
                const imageUrl = readImage(row.data);
                const url = readUrl(row.data);

                return (
                  <tr key={row.id}>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {row.position}
                    </td>

                    <td className="px-4 py-3">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageUrl}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div
                          className="h-12 w-12 rounded-lg"
                          style={{ background: "var(--bg-tertiary)" }}
                        />
                      )}
                    </td>

                    <td
                      className="max-w-md px-4 py-3 font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {readValue(row.data, [
                        "title",
                        "name",
                        "productTitle",
                        "product_title",
                      ])}
                    </td>

                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {readValue(row.data, [
                        "price",
                        "priceText",
                        "price_text",
                        "salePrice",
                        "sale_price",
                      ])}
                    </td>

                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {readValue(row.data, [
                        "source",
                        "store",
                        "storeName",
                        "vendor",
                        "seller",
                      ])}
                    </td>

                    <td className="px-4 py-3">
                      {url !== "-" ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold hover:underline"
                          style={{ color: "var(--accent-primary)" }}
                        >
                          Open
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}