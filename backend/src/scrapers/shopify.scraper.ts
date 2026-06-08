import dns from "node:dns/promises";
import net from "node:net";

import type { ShopifyFilters } from "../jobs/jobs.schema.js";

/**
 * Normalized shopify product shape stored in DB.
 */
export type ShopifyProduct = {
  platform: "shopify";

  // Product identity
  productId: string;
  title: string;
  handle: string;
  productUrl: string;

  // Classification
  vendor: string | null;
  productType: string | null;
  tags: string[];

  // Product-level pricing summary
  price: number | null; // usually minAvailablePrice or minPrice
  minPrice: number | null;
  maxPrice: number | null;
  minCompareAtPrice: number | null;
  maxCompareAtPrice: number | null;

  // Product-level stock summary
  isAvailable: boolean;
  availableVariantCount: number;
  unavailableVariantCount: number;
  variantCount: number;

  // Product-level SKU summary
  skus: string[];
  skuCount: number;
  hasSkuMissing: boolean;

  // Product options
  options: ShopifyProductOption[];

  // Product images
  imageUrl: string | null; // main image
  imageCount: number;
  images: ShopifyProductImage[];

  // Detailed variants
  variants: ShopifyVariant[];

  // Dates
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ShopifyProductOption = {
  name: string;
  position: number | null;
  values: string[];
};

export type ShopifyProductImage = {
  imageId: string | null;
  src: string;
  position: number | null;
  width: number | null;
  height: number | null;
  variantIds: string[];
};

export type ShopifyVariant = {
  variantId: string;
  title: string | null;

  sku: string | null;

  option1: string | null;
  option2: string | null;
  option3: string | null;

  price: number | null;
  compareAtPrice: number | null;

  available: boolean;
  requiresShipping: boolean | null;
  taxable: boolean | null;

  grams: number | null;
  position: number | null;

  imageUrl: string | null;

  createdAt: string | null;
  updatedAt: string | null;
};

/**
 * Raw Shopify API product shape.
 * We keep this loose because Shopify responses vary slightly by store/theme/apps.
 */
type ShopifyApiProduct = {
  id?: number | string;
  title?: string;
  handle?: string;
  vendor?: string;
  product_type?: string;
  // Fix: Shopify tags may be comma-separated string or array
  tags?: string | string[];

  published_at?: string;
  created_at?: string;
  updated_at?: string;

  variants?: Array<{
    id?: number | string;
    title?: string;

    option1?: string | null;
    option2?: string | null;
    option3?: string | null;

    sku?: string | null;

    requires_shipping?: boolean;
    taxable?: boolean;
    available?: boolean;

    price?: string;
    compare_at_price?: string | null;

    grams?: number;
    position?: number;

    featured_image?: {
      id?: number | string;
      src?: string;
    } | null;

    created_at?: string;
    updated_at?: string;
  }>;

  images?: Array<{
    id?: number | string;
    src?: string;
    position?: number;
    width?: number;
    height?: number;
    variant_ids?: Array<number | string>;
  }>;

  options?: Array<{
    name?: string;
    position?: number;
    values?: string[];
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
 * Since storeUrl is user-provided from client app, do not allow
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

function parsePrice(value: string | number | undefined | null): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = value
    .trim()
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  if (!cleaned) return null;

  const parsed = Number.parseFloat(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

function joinSearchParts(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function productMatchesQuery(product: ShopifyProduct, query: string) {
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) return true;

  const optionText = product.options
    .map((option) => joinSearchParts([option.name, option.values.join(" ")]))
    .join(" ");

  const variantText = product.variants
    .map((variant) =>
      joinSearchParts([
        variant.title,
        variant.sku,
        variant.option1,
        variant.option2,
        variant.option3,
      ])
    )
    .join(" ");

  const searchableText = joinSearchParts([
    product.title,
    product.vendor,
    product.productType,
    product.handle,
    product.tags.join(" "),
    product.skus.join(" "),
    optionText,
    variantText,
  ]).toLowerCase();

  return searchableText.includes(cleanQuery);
}

function normalizeTags(tags: string | string[] | undefined | null): string[] {
  if (!tags) return [];

  if (Array.isArray(tags)) {
    return uniqueStrings(tags);
  }

  return uniqueStrings(
    tags
      .split(",")
      .map((tag) => tag.trim())
  );
}

function mapShopifyProduct(input: {
  storeUrl: string;
  product: ShopifyApiProduct;
}): ShopifyProduct | null {
  const handle = input.product.handle?.trim();

  if (!handle) return null;

  const variants = input.product.variants ?? [];
  const images = input.product.images ?? [];
  const options = input.product.options ?? [];

  const mappedVariants: ShopifyVariant[] = variants.map((variant) => ({
    variantId: String(variant.id ?? ""),
    title: variant.title?.trim() || null,

    sku: variant.sku?.trim() || null,

    option1: variant.option1?.trim() || null,
    option2: variant.option2?.trim() || null,
    option3: variant.option3?.trim() || null,

    price: parsePrice(variant.price),
    compareAtPrice: parsePrice(variant.compare_at_price),

    available: variant.available === true,
    requiresShipping: variant.requires_shipping ?? null,
    taxable: variant.taxable ?? null,

    grams:
      typeof variant.grams === "number" && Number.isFinite(variant.grams)
        ? variant.grams
        : null,

    position:
      typeof variant.position === "number" && Number.isFinite(variant.position)
        ? variant.position
        : null,

    imageUrl: variant.featured_image?.src?.trim() || null,

    createdAt: variant.created_at ?? null,
    updatedAt: variant.updated_at ?? null,
  }));

  const prices = mappedVariants.map((variant) => variant.price);
  const compareAtPrices = mappedVariants.map((variant) => variant.compareAtPrice);

  const minPrice = minOrNull(prices);
  const maxPrice = maxOrNull(prices);
  const minCompareAtPrice = minOrNull(compareAtPrices);
  const maxCompareAtPrice = maxOrNull(compareAtPrices);

  const availableVariantCount = mappedVariants.filter(
    (variant) => variant.available
  ).length;

  const unavailableVariantCount = mappedVariants.length - availableVariantCount;

  const skus = uniqueStrings(mappedVariants.map((variant) => variant.sku));

  const hasSkuMissing = mappedVariants.some(
    (variant) => !variant.sku || variant.sku.trim() === ""
  );

  const mappedImages: ShopifyProductImage[] = images
    .map((image) => ({
      imageId: image.id ? String(image.id) : null,
      src: image.src?.trim() ?? "",
      position:
        typeof image.position === "number" && Number.isFinite(image.position)
          ? image.position
          : null,
      width:
        typeof image.width === "number" && Number.isFinite(image.width)
          ? image.width
          : null,
      height:
        typeof image.height === "number" && Number.isFinite(image.height)
          ? image.height
          : null,
      variantIds: (image.variant_ids ?? []).map((id) => String(id)),
    }))
    .filter((image) => image.src !== "");

  const mappedOptions: ShopifyProductOption[] = options
    .map((option) => ({
      name: option.name?.trim() || "Option",
      position:
        typeof option.position === "number" && Number.isFinite(option.position)
          ? option.position
          : null,
      values: uniqueStrings(option.values ?? []),
    }))
    .filter((option) => option.values.length > 0);

  return {
    platform: "shopify",

    productId: String(input.product.id ?? handle),
    title: input.product.title?.trim() || handle,
    handle,
    productUrl: `${input.storeUrl}/products/${encodeURIComponent(handle)}`,

    vendor: input.product.vendor?.trim() || null,
    productType: input.product.product_type?.trim() || null,
    tags: normalizeTags(input.product.tags),

    // Use minimum price as main business price.
    price: minPrice,
    minPrice,
    maxPrice,
    minCompareAtPrice,
    maxCompareAtPrice,

    isAvailable: availableVariantCount > 0,
    availableVariantCount,
    unavailableVariantCount,
    variantCount: mappedVariants.length,

    skus,
    skuCount: skus.length,
    hasSkuMissing,

    options: mappedOptions,

    imageUrl: mappedImages[0]?.src ?? null,
    imageCount: mappedImages.length,
    images: mappedImages,

    variants: mappedVariants,

    publishedAt: input.product.published_at ?? null,
    createdAt: input.product.created_at ?? null,
    updatedAt: input.product.updated_at ?? null,
  };
}

function minOrNull(values: Array<number | null | undefined>) {
  const numbers = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );

  return numbers.length > 0 ? Math.min(...numbers) : null;
}

function maxOrNull(values: Array<number | null | undefined>) {
  const numbers = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );

  return numbers.length > 0 ? Math.max(...numbers) : null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ];
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

    try {
      return (await response.json()) as ShopifyProductsResponse;
    } catch {
      throw new ShopifyScrapeError("Invalid JSON response from Shopify products endpoint");
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ShopifyScrapeError("Shopify products request timed out");
    }
    throw error;
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

  /**
   * null means scrape all available product pages.
   */
  maxPages?: number | null;
}) {
  const normalizedStoreUrl = await normalizeAndValidateStoreUrl(input.storeUrl);

  /**
   * null = no fixed page limit.
   * The loop stops only when Shopify has no more products.
   */
  const maxPages = input.maxPages ?? null;
  const allProducts: ShopifyProduct[] = [];

  for (let page = 1; ; page += 1) {
    if (maxPages !== null && page > maxPages) {
      break;
    }

    const endpoint = new URL(`${normalizedStoreUrl}/products.json`);

    /**
     * Shopify commonly allows up to 250 products per page.
     */
    endpoint.searchParams.set("limit", "250");
    endpoint.searchParams.set("page", String(page));

    const json = await fetchJsonWithTimeout(endpoint.toString(), 15000);

    const apiProducts = json.products ?? [];

    /**
     * No products means no more pages.
     */
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

    console.log({
      event: "shopify_page_scraped",
      storeUrl: normalizedStoreUrl,
      page,
      productsOnPage: apiProducts.length,
      matchedProductsSoFar: allProducts.length,
    });

    /**
     * If Shopify returns less than 250, this is the last page.
     */
    if (apiProducts.length < 250) {
      break;
    }
  }

  return allProducts;
}
