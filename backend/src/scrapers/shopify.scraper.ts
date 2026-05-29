import dns from "node:dns/promises";
import net from "node:net";

import type { ShopifyFilters } from "../jobs/jobs.schema.js";

/**
 * Normalized product shape stored in DB.
 */
export type ShopifyProduct = {
  title: string;
  price: number | null;
  currency: string;
  vendor: string | null;
  productType: string | null;
  isAvailable: boolean;
  variantCount: number;
  productUrl: string;
  imageUrl: string | null;
  handle: string;
};

/**
 * Raw Shopify API product shape.
 * We keep this loose because Shopify responses vary slightly by store/theme/apps.
 */
type ShopifyApiProduct = {
  title?: string;
  handle?: string;
  vendor?: string;
  product_type?: string;
  variants?: Array<{
    price?: string;
    available?: boolean;
  }>;
  images?: Array<{
    src?: string;
  }>;
};

type ShopifyProductsResponse = {
  products?: ShopifyApiProduct[];
};

export class ShopifyScrapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopifyScrapeError";
  }
}

/**
 * Basic SSRF protection.
 * Since storeUrl is user-provided from spreadsheet/Postman, do not allow
 * localhost/private IP targets.
 */
function isPrivateIp(address: string) {
  if (net.isIP(address) === 0) return false;

  if (address === "127.0.0.1" || address === "::1") return true;

  // IPv4 private ranges.
  if (address.startsWith("10.")) return true;
  if (address.startsWith("192.168.")) return true;

  const parts = address.split(".").map(Number);
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }

  return false;
}

/**
 * Validate and normalize store URL.
 * Example:
 * https://example.myshopify.com/products -> https://example.myshopify.com
 */
export async function normalizeAndValidateStoreUrl(storeUrl: string) {
  let url: URL;

  try {
    url = new URL(storeUrl);
  } catch {
    throw new ShopifyScrapeError("Invalid Shopify store URL");
  }

  if (url.protocol !== "https:") {
    throw new ShopifyScrapeError("Shopify store URL must use HTTPS");
  }

  const hostname = url.hostname.toLowerCase();

  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new ShopifyScrapeError("Local/private hostnames are not allowed");
  }

  /**
   * If hostname is already an IP, block private IPs.
   */
  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new ShopifyScrapeError("Private IP addresses are not allowed");
  }

  /**
   * DNS check blocks domains that resolve to private IPs.
   */
  try {
    const records = await dns.lookup(hostname, { all: true });

    for (const record of records) {
      if (isPrivateIp(record.address)) {
        throw new ShopifyScrapeError("Store URL resolves to a private IP address");
      }
    }
  } catch (error) {
    if (error instanceof ShopifyScrapeError) throw error;

    throw new ShopifyScrapeError("Could not resolve Shopify store hostname");
  }

  return `${url.protocol}//${url.hostname}`;
}

function parsePrice(value: string | undefined): number | null {
  if (!value) return null;

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function productMatchesQuery(product: ShopifyProduct, query: string) {
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) return true;

  const searchableText = [
    product.title,
    product.vendor ?? "",
    product.productType ?? "",
    product.handle,
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(cleanQuery);
}

function mapShopifyProduct(input: {
  storeUrl: string;
  product: ShopifyApiProduct;
}): ShopifyProduct | null {
  const handle = input.product.handle?.trim();

  if (!handle) return null;

  const variants = input.product.variants ?? [];
  const firstVariant = variants[0];

  return {
    title: input.product.title?.trim() || handle,
    price: parsePrice(firstVariant?.price),
    currency: "USD",
    vendor: input.product.vendor?.trim() || null,
    productType: input.product.product_type?.trim() || null,

    /**
     * A product is available if any variant is available.
     */
    isAvailable: variants.some((variant) => variant.available === true),

    variantCount: variants.length,
    productUrl: `${input.storeUrl}/products/${handle}`,
    imageUrl: input.product.images?.[0]?.src ?? null,
    handle,
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent":
          "Mozilla/5.0 (compatible; DataPulseBot/1.0; +https://datapulse.local)",
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ShopifyScrapeError(
          "This Shopify store blocks public /products.json access"
        );
      }

      if (response.status === 404) {
        throw new ShopifyScrapeError(
          "This store does not expose /products.json"
        );
      }

      throw new ShopifyScrapeError(
        `Shopify products endpoint returned HTTP ${response.status}`
      );
    }

    return (await response.json()) as ShopifyProductsResponse;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Main Shopify scraper.
 * Primary method: /products.json.
 * No browser automation, no proxy, no Playwright.
 */
export async function scrapeShopifyProducts(input: {
  storeUrl: string;
  query: string;
  filters: ShopifyFilters;
  maxPages?: number;
}) {
  const normalizedStoreUrl = await normalizeAndValidateStoreUrl(input.storeUrl);

  const maxPages = input.maxPages ?? 2;
  const allProducts: ShopifyProduct[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const endpoint = new URL(`${normalizedStoreUrl}/products.json`);

    /**
     * Shopify max limit is commonly 250.
     */
    endpoint.searchParams.set("limit", "250");
    endpoint.searchParams.set("page", String(page));

    const json = await fetchJsonWithTimeout(endpoint.toString(), 15000);

    const apiProducts = json.products ?? [];

    if (apiProducts.length === 0) {
      break;
    }

    const mappedProducts = apiProducts
      .map((product) =>
        mapShopifyProduct({
          storeUrl: normalizedStoreUrl,
          product,
        })
      )
      .filter((product): product is ShopifyProduct => product !== null)
      .filter((product) => productMatchesQuery(product, input.query));

    allProducts.push(...mappedProducts);

    /**
     * If Shopify returns less than limit, there are no more pages.
     */
    if (apiProducts.length < 250) {
      break;
    }
  }

  return allProducts;
}


