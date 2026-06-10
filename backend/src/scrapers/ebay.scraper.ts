import { env } from "../env.js";
import type { EbayFilters } from "../jobs/jobs.schema.js";
import { getEbayAccessToken } from "../services/ebay-oauth.service.js";

export type EbayProduct = {
  /**
   * Platform marker helps future common ResultsTable mapping.
   */
  platform: "ebay";

  title: string;
  price: number | null;
  currency: string | null;
  condition: string | null;
  shippingCost: number | null;
  isFreeShipping: boolean;
  listingType: "BIN" | "Auction" | "Unknown";
  itemUrl: string | null;
  imageUrl: string | null;
  itemId: string;
  sellerUsername: string | null;
  endTime: string | null;

  /**
   * Browse API search returns active listings.
   * For MVP, returned items are treated as available.
   */
  isAvailable: boolean;
};

type EbaySearchResponse = {
  itemSummaries?: EbayItemSummary[];
  total?: number;
  limit?: number;
  offset?: number;
};

type EbayItemSummary = {
  itemId?: string;
  title?: string;
  price?: {
    value?: string;
    currency?: string;
  };
  condition?: string;
  buyingOptions?: string[];
  itemWebUrl?: string;
  itemAffiliateWebUrl?: string;
  image?: {
    imageUrl?: string;
  };
  shippingOptions?: Array<{
    shippingCostType?: string;
    shippingCost?: {
      value?: string;
      currency?: string;
    };
  }>;
  seller?: {
    username?: string;
  };
  itemEndDate?: string;
};

const EBAY_SEARCH_RETRIEVAL_CAP = 10_000;

function getEbayBrowseBaseUrl() {
  if (env.EBAY_ENVIRONMENT === "production") {
    return "https://api.ebay.com/buy/browse/v1";
  }

  return "https://api.sandbox.ebay.com/buy/browse/v1";
}

/**
 * Keep the requested page size safe.
 *
 * Your current .env uses EBAY_SEARCH_LIMIT=200.
 * If env is missing or invalid, fallback to 200.
 */
function getPageLimit() {
  const limit = Number(env.EBAY_SEARCH_LIMIT);

  if (!Number.isFinite(limit) || limit <= 0) {
    return 200;
  }

  return Math.min(Math.floor(limit), 200);
}

/**
 * Maximum total products to fetch for one query.
 *
 * eBay Browse API search has a retrieval cap of 10,000.
 * Even if .env asks for more, keep it capped at 10,000.
 */
function getMaxTotalToFetch() {
  const configuredMax = Number(env.EBAY_SEARCH_MAX_TOTAL ?? 10_000);

  if (!Number.isFinite(configuredMax) || configuredMax <= 0) {
    return EBAY_SEARCH_RETRIEVAL_CAP;
  }

  return Math.min(Math.floor(configuredMax), EBAY_SEARCH_RETRIEVAL_CAP);
}

/**
 * eBay price values usually arrive as numeric strings such as "17.99".
 */
function parseNumber(value: string | undefined): number | null {
  if (!value) return null;

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function mapListingType(buyingOptions: string[] | undefined) {
  if (!buyingOptions || buyingOptions.length === 0) {
    return "Unknown" as const;
  }

  if (buyingOptions.includes("FIXED_PRICE")) {
    return "BIN" as const;
  }

  if (buyingOptions.includes("AUCTION")) {
    return "Auction" as const;
  }

  return "Unknown" as const;
}

function mapEbayItem(item: EbayItemSummary): EbayProduct | null {
  if (!item.itemId) return null;

  const firstShippingOption = item.shippingOptions?.[0];

  const shippingCostType =
    firstShippingOption?.shippingCostType?.toUpperCase() ?? "";

  const shippingCost = parseNumber(firstShippingOption?.shippingCost?.value);

  const isFreeShipping = shippingCostType === "FREE" || shippingCost === 0;

  return {
    platform: "ebay",
    title: item.title ?? "",
    price: parseNumber(item.price?.value),
    currency: item.price?.currency ?? null,
    condition: item.condition ?? null,
    shippingCost,
    isFreeShipping,
    listingType: mapListingType(item.buyingOptions),
    itemUrl: item.itemAffiliateWebUrl ?? item.itemWebUrl ?? null,
    imageUrl: item.image?.imageUrl ?? null,
    itemId: item.itemId,
    sellerUsername: item.seller?.username ?? null,
    endTime: item.itemEndDate ?? null,
    isAvailable: true,
  };
}

function buildEbayApiFilter(filters: EbayFilters) {
  const apiFilters: string[] = [];

  /**
   * Buy It Now / fixed price listings.
   */
  if (filters.buyItNowOnly) {
    apiFilters.push("buyingOptions:{FIXED_PRICE}");
  }

  /**
   * Price range filter.
   *
   * eBay Browse API supports range-style filters.
   * Keep local price filtering also as a safety layer.
   */
  if (
    typeof filters.minPrice === "number" &&
    typeof filters.maxPrice === "number"
  ) {
    apiFilters.push(`price:[${filters.minPrice}..${filters.maxPrice}]`);
  } else if (typeof filters.minPrice === "number") {
    apiFilters.push(`price:[${filters.minPrice}..]`);
  } else if (typeof filters.maxPrice === "number") {
    apiFilters.push(`price:[..${filters.maxPrice}]`);
  }

  /**
   * Free shipping.
   *
   * eBay uses delivery-cost filter for this.
   */
  if (filters.freeShippingOnly) {
    apiFilters.push("maxDeliveryCost:0");
  }

  return apiFilters.length > 0 ? apiFilters.join(",") : undefined;
}

function safeParseJson(text: string): EbaySearchResponse {
  try {
    return JSON.parse(text) as EbaySearchResponse;
  } catch {
    throw new Error("eBay Browse API returned invalid JSON response");
  }
}

async function fetchEbaySearchPage(input: {
  token: string;
  query: string;
  filters: EbayFilters;
  limit: number;
  offset: number;
}) {
  const url = new URL(`${getEbayBrowseBaseUrl()}/item_summary/search`);

  url.searchParams.set("q", input.query);
  url.searchParams.set("limit", String(input.limit));
  url.searchParams.set("offset", String(input.offset));

  const apiFilter = buildEbayApiFilter(input.filters);

  if (apiFilter) {
    url.searchParams.set("filter", apiFilter);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "X-EBAY-C-MARKETPLACE-ID": env.EBAY_MARKETPLACE_ID,
      Accept: "application/json",
    },
  });

  const responseText = await response.text();

  if (!response.ok) {
    const invalidFilterHint =
      response.status === 400 ? " Bad request caused by invalid eBay filter." : "";

    throw new Error(
      `eBay Browse API failed with HTTP ${response.status}:${invalidFilterHint} ${responseText}`
    );
  }

  return safeParseJson(responseText);
}

export async function fetchEbayProducts(input: {
  query: string;
  filters: EbayFilters;
}) {
  const token = await getEbayAccessToken();

  const pageLimit = getPageLimit();
  const maxTotalToFetch = getMaxTotalToFetch();

  const allProducts: EbayProduct[] = [];
  const seenItemIds = new Set<string>();

  let offset = 0;
  let totalFromEbay: number | null = null;

  while (offset < maxTotalToFetch) {
    const remaining = maxTotalToFetch - offset;
    const limitForThisPage = Math.min(pageLimit, remaining);

    const json = await fetchEbaySearchPage({
      token,
      query: input.query,
      filters: input.filters,
      limit: limitForThisPage,
      offset,
    });

    const pageItems = json.itemSummaries ?? [];

    if (totalFromEbay === null) {
      totalFromEbay = typeof json.total === "number" ? json.total : null;
    }

    const mappedProducts = pageItems
      .map(mapEbayItem)
      .filter((product): product is EbayProduct => product !== null);

    for (const product of mappedProducts) {
      /**
       * Defensive de-duplication.
       * Pagination should not duplicate itemId, but this protects us if eBay
       * ranking changes during pagination.
       */
      if (!seenItemIds.has(product.itemId)) {
        seenItemIds.add(product.itemId);
        allProducts.push(product);
      }
    }

    console.log({
      event: "ebay_api_page_fetched",
      query: input.query,
      marketplaceId: env.EBAY_MARKETPLACE_ID,
      offset,
      requestedLimit: limitForThisPage,
      returnedRaw: pageItems.length,
      returnedMapped: mappedProducts.length,
      totalCollected: allProducts.length,
      totalFromEbay,
    });

    /**
     * Stop if eBay returned no items.
     */
    if (pageItems.length === 0) {
      break;
    }

    /**
     * Stop if eBay returned fewer than requested.
     * That usually means last page.
     */
    if (pageItems.length < limitForThisPage) {
      break;
    }

    /**
     * Stop if eBay tells us we already reached the total.
     */
    if (typeof totalFromEbay === "number" && offset + pageItems.length >= totalFromEbay) {
      break;
    }

    offset += limitForThisPage;
  }

  console.log({
    event: "ebay_api_results_fetched_all_pages",
    query: input.query,
    marketplaceId: env.EBAY_MARKETPLACE_ID,
    totalFromEbay,
    totalCollected: allProducts.length,
    maxTotalToFetch,
    pageLimit,
  });

  return allProducts;
}