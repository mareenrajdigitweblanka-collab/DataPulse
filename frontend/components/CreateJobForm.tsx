"use client";

import { useEffect, useMemo, useState } from "react";
import type { Channel, CreateJobPayload, Job } from "@/lib/types";
import { CheckboxField, Field } from "./ui";

const CHANNELS: Channel[] = ["shopify", "ebay", "google", "amazon"];

function toNumberOrUndefined(value: string) {
  if (value.trim() === "") return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function CreateJobForm({
  loading,
  prefill,
  onCreateJob,
}: {
  loading: boolean;
  prefill?: Job | null;
  onCreateJob: (payload: CreateJobPayload) => Promise<void>;
}) {
  const [channel, setChannel] = useState<Channel>("shopify");
  const [query, setQuery] = useState("Metal Lamp Shade");

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
    "us" | "gb" | "ca" | "au" | "de"
  >("gb");
  const [googleLanguage, setGoogleLanguage] = useState("en");
  const [googleSortBy, setGoogleSortBy] = useState<
    "relevance" | "price_asc" | "price_desc" | "rating"
  >("relevance");
  const [storeName, setStoreName] = useState("");

  const [minRating, setMinRating] = useState("4");
  const [minReviewCount, setMinReviewCount] = useState("100");

  // Populate form whenever a different job is selected from Recent Jobs.
  // Keyed on job id so status-only updates (queued→running) don't re-fire.
  useEffect(() => {
    if (!prefill) return;

    const f = prefill.filters as Record<string, unknown>;

    setChannel(prefill.channel);
    setQuery(prefill.query);
    setMinPrice(f.minPrice != null ? String(f.minPrice) : "");
    setMaxPrice(f.maxPrice != null ? String(f.maxPrice) : "");
    setInStockOnly(Boolean(f.inStockOnly));

    // Shopify
    setStoreUrl(typeof f.storeUrl === "string" ? f.storeUrl : "");
    setVendor(typeof f.vendor === "string" ? f.vendor : "");
    setProductType(typeof f.productType === "string" ? f.productType : "");

    // eBay
    setEbayCondition(
      (f.condition as "any" | "new" | "used" | "refurbished") ?? "any"
    );
    setFreeShippingOnly(Boolean(f.freeShippingOnly));
    setBuyItNowOnly(Boolean(f.buyItNowOnly));

    // Google
    setGoogleCountry(
      (f.country as "us" | "gb" | "ca" | "au" | "de") ?? "gb"
    );
    setGoogleLanguage(typeof f.language === "string" ? f.language : "en");
    setGoogleSortBy(
      (f.sortBy as "relevance" | "price_asc" | "price_desc" | "rating") ??
        "relevance"
    );
    setStoreName(typeof f.storeName === "string" ? f.storeName : "");

    // Amazon
    setMinRating(f.minRating != null ? String(f.minRating) : "");
    setMinReviewCount(f.minReviewCount != null ? String(f.minReviewCount) : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.id]);

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

    return "Amazon requires a search query and supports rating, review, and stock filters.";
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
      },
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreateJob(buildPayload());
  }

  return (
    <section className="card p-6">
      <h2
        className="text-lg font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        Create Scraping Job
      </h2>
      <p
        className="mt-1 text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
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

        <div
          className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            background: "var(--accent-primary-soft)",
            color: "var(--accent-primary)",
            border: "1px solid",
            borderColor: "color-mix(in srgb, var(--accent-primary) 20%, transparent)",
          }}
        >
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
                    event.target.value as "us" | "gb" | "ca" | "au" | "de"
                  )
                }
              >
                <option value="gb">UK</option>
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
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
          style={{
            background: "var(--gradient-brand)",
          }}
        >
          {loading ? (
            <>
              <span className="spinner" style={{ borderTopColor: "white", borderColor: "rgba(255,255,255,0.3)" }} />
              Creating job...
            </>
          ) : (
            "Create Job"
          )}
        </button>
      </form>
    </section>
  );
}