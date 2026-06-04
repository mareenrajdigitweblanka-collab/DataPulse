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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Results</h2>
        <p className="mt-1 text-sm text-slate-500">
          Generic table for Shopify, eBay, Google Shopping, and Amazon results.
        </p>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500">
            Loading results...
          </div>
        ) : results.length === 0 ? (
          <div className="p-6">
            <EmptyBox message="No results loaded yet." />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  #
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  Image
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  Title
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  Price
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  Source
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  URL
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {results.map((row) => {
                const imageUrl = readImage(row.data);
                const url = readUrl(row.data);

                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-slate-600">
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
                        <div className="h-12 w-12 rounded-lg bg-slate-100" />
                      )}
                    </td>

                    <td className="max-w-md px-4 py-3 font-medium text-slate-800">
                      {readValue(row.data, [
                        "title",
                        "name",
                        "productTitle",
                        "product_title",
                      ])}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {readValue(row.data, [
                        "price",
                        "priceText",
                        "price_text",
                        "salePrice",
                        "sale_price",
                      ])}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
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
                          className="font-semibold text-blue-700 hover:underline"
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