"use client";

import { useMemo, useState } from "react";
import type { Channel, CreateJobPayload } from "@/lib/types";
import { CheckboxField, Field } from "./ui";

const CHANNELS: Channel[] = ["shopify", "ebay", "google", "amazon"];

function toNumberOrUndefined(value: string) {
  if (value.trim() === "") return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function CreateJobForm({
  loading,
  onCreateJob,
}: {
  loading: boolean;
  onCreateJob: (payload: CreateJobPayload) => Promise<void>;
}) {
  const [channel, setChannel] = useState<Channel>("shopify");
  const [query, setQuery] = useState("light");

  const [storeUrl, setStoreUrl] = useState("https://ledsone.co.uk");
  const [minPrice, setMinPrice] = useState("10");
  const [maxPrice, setMaxPrice] = useState("150");
  const [inStockOnly, setInStockOnly] = useState(true);

  const [vendor, setVendor] = useState("");
  const [productType, setProductType] = useState("");

  const [ebayCondition, setEbayCondition] = useState<
    "any" | "new" | "used" | "refurbished"
  >("any");
  const [freeShippingOnly, setFreeShippingOnly] = useState(false);
  const [buyItNowOnly, setBuyItNowOnly] = useState(false);

  const [googleCountry, setGoogleCountry] = useState<
    "us" | "uk" | "ca" | "au" | "de"
  >("uk");
  const [googleLanguage, setGoogleLanguage] = useState("en");
  const [googleSortBy, setGoogleSortBy] = useState<
    "relevance" | "price_asc" | "price_desc" | "rating"
  >("relevance");
  const [storeName, setStoreName] = useState("");

  const [minRating, setMinRating] = useState("4");
  const [minReviewCount, setMinReviewCount] = useState("100");
  const [primeOnly, setPrimeOnly] = useState(false);

  const helpText = useMemo(() => {
    if (channel === "shopify") {
      return "Shopify supports storeUrl. Query can be empty for whole-store scraping.";
    }

    if (channel === "ebay") {
      return "eBay requires a search query and supports condition filters.";
    }

    if (channel === "google") {
      return "Google Shopping requires a search query and supports country/language filters.";
    }

    return "Amazon requires a search query and supports rating, review, stock, and Prime filters.";
  }, [channel]);

  function buildPayload(): CreateJobPayload {
    const min = toNumberOrUndefined(minPrice);
    const max = toNumberOrUndefined(maxPrice);

    if (channel === "shopify") {
      return {
        channel: "shopify",
        query,
        filters: {
          storeUrl,
          minPrice: min,
          maxPrice: max,
          inStockOnly,
          vendor,
          productType,
        },
      };
    }

    if (channel === "ebay") {
      return {
        channel: "ebay",
        query,
        filters: {
          minPrice: min,
          maxPrice: max,
          condition: ebayCondition,
          freeShippingOnly,
          buyItNowOnly,
        },
      };
    }

    if (channel === "google") {
      return {
        channel: "google",
        query,
        filters: {
          minPrice: min,
          maxPrice: max,
          country: googleCountry,
          language: googleLanguage,
          sortBy: googleSortBy,
          storeName,
          inStockOnly,
        },
      };
    }

    return {
      channel: "amazon",
      query,
      filters: {
        minPrice: min,
        maxPrice: max,
        inStockOnly,
        minRating: toNumberOrUndefined(minRating),
        minReviewCount: toNumberOrUndefined(minReviewCount),
        primeOnly,
      },
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreateJob(buildPayload());
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Create Scraping Job</h2>
      <p className="mt-1 text-sm text-slate-500">
        Submit a new scraping job to your Fastify backend.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Channel">
          <select
            className="input"
            value={channel}
            onChange={(event) => setChannel(event.target.value as Channel)}
          >
            {CHANNELS.map((item) => (
              <option key={item} value={item}>
                {item.toUpperCase()}
              </option>
            ))}
          </select>
        </Field>

        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {helpText}
        </div>

        <Field label="Query">
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={channel === "shopify" ? "Optional" : "Required"}
          />
        </Field>

        {channel === "shopify" && (
          <>
            <Field label="Shopify Store URL">
              <input
                className="input"
                value={storeUrl}
                onChange={(event) => setStoreUrl(event.target.value)}
                placeholder="https://ledsone.co.uk"
                required
              />
            </Field>

            <Field label="Vendor">
              <input
                className="input"
                value={vendor}
                onChange={(event) => setVendor(event.target.value)}
                placeholder="Optional"
              />
            </Field>

            <Field label="Product Type">
              <input
                className="input"
                value={productType}
                onChange={(event) => setProductType(event.target.value)}
                placeholder="Optional"
              />
            </Field>
          </>
        )}

        {channel === "ebay" && (
          <>
            <Field label="Condition">
              <select
                className="input"
                value={ebayCondition}
                onChange={(event) =>
                  setEbayCondition(
                    event.target.value as "any" | "new" | "used" | "refurbished"
                  )
                }
              >
                <option value="any">Any</option>
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="refurbished">Refurbished</option>
              </select>
            </Field>

            <CheckboxField
              label="Free shipping only"
              checked={freeShippingOnly}
              onChange={setFreeShippingOnly}
            />

            <CheckboxField
              label="Buy it now only"
              checked={buyItNowOnly}
              onChange={setBuyItNowOnly}
            />
          </>
        )}

        {channel === "google" && (
          <>
            <Field label="Country">
              <select
                className="input"
                value={googleCountry}
                onChange={(event) =>
                  setGoogleCountry(
                    event.target.value as "us" | "uk" | "ca" | "au" | "de"
                  )
                }
              >
                <option value="uk">UK</option>
                <option value="us">US</option>
                <option value="ca">Canada</option>
                <option value="au">Australia</option>
                <option value="de">Germany</option>
              </select>
            </Field>

            <Field label="Language">
              <input
                className="input"
                value={googleLanguage}
                onChange={(event) => setGoogleLanguage(event.target.value)}
              />
            </Field>

            <Field label="Sort By">
              <select
                className="input"
                value={googleSortBy}
                onChange={(event) =>
                  setGoogleSortBy(
                    event.target.value as
                      | "relevance"
                      | "price_asc"
                      | "price_desc"
                      | "rating"
                  )
                }
              >
                <option value="relevance">Relevance</option>
                <option value="price_asc">Price Asc</option>
                <option value="price_desc">Price Desc</option>
                <option value="rating">Rating</option>
              </select>
            </Field>

            <Field label="Store Name">
              <input
                className="input"
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                placeholder="Optional"
              />
            </Field>
          </>
        )}

        {channel === "amazon" && (
          <>
            <Field label="Minimum Rating">
              <input
                className="input"
                type="number"
                min="1"
                max="5"
                value={minRating}
                onChange={(event) => setMinRating(event.target.value)}
              />
            </Field>

            <Field label="Minimum Review Count">
              <input
                className="input"
                type="number"
                min="0"
                value={minReviewCount}
                onChange={(event) => setMinReviewCount(event.target.value)}
              />
            </Field>

            <CheckboxField
              label="Prime only"
              checked={primeOnly}
              onChange={setPrimeOnly}
            />
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Min Price">
            <input
              className="input"
              type="number"
              min="0"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
            />
          </Field>

          <Field label="Max Price">
            <input
              className="input"
              type="number"
              min="0"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            />
          </Field>
        </div>

        {(channel === "shopify" ||
          channel === "google" ||
          channel === "amazon") && (
          <CheckboxField
            label="In stock only"
            checked={inStockOnly}
            onChange={setInStockOnly}
          />
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
        >
          {loading ? "Creating job..." : "Create Job"}
        </button>
      </form>
    </section>
  );
}