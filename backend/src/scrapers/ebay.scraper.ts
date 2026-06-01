import { env } from "../env.js";
import type { EbayFilters } from "../jobs/jobs.schema.js";
import { getEbayAccessToken } from "../services/ebay-oauth.service.js";

export type EbayProduct = {
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
  endTime: string | null;
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
  itemEndDate?: string;
};

function getEbayBrowseBaseUrl() {
  if (env.EBAY_ENVIRONMENT === "production") {
    return "https://api.ebay.com/buy/browse/v1";
  }

  return "https://api.sandbox.ebay.com/buy/browse/v1";
}

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

  const isFreeShipping =
    shippingCostType === "FREE" || shippingCost === 0;

  return {
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
    endTime: item.itemEndDate ?? null,

    /**
     * Browse API search returns active purchasable listings.
     * For MVP we treat returned listings as available.
     */
    isAvailable: true,
  };
}

/**
 * Optional API-level filter builder.
 * For MVP we keep most filtering server-side for consistency.
 */
function buildEbayApiFilter(filters: EbayFilters) {
  const apiFilters: string[] = [];

  if (filters.buyItNowOnly) {
    apiFilters.push("buyingOptions:{FIXED_PRICE}");
  }

  /**
   * Keep condition filtering in our local filter for now because eBay condition
   * strings vary by marketplace and category.
   */

  return apiFilters.length > 0 ? apiFilters.join(",") : undefined;
}

export async function fetchEbayProducts(input: {
  query: string;
  filters: EbayFilters;
}) {
  const token = await getEbayAccessToken();

  const url = new URL(`${getEbayBrowseBaseUrl()}/item_summary/search`);

  url.searchParams.set("q", input.query);
  url.searchParams.set("limit", String(env.EBAY_SEARCH_LIMIT));

  const apiFilter = buildEbayApiFilter(input.filters);

  if (apiFilter) {
    url.searchParams.set("filter", apiFilter);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": env.EBAY_MARKETPLACE_ID,
      Accept: "application/json",
    },
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `eBay Browse API failed with HTTP ${response.status}: ${responseText}`
    );
  }

  const json = JSON.parse(responseText) as EbaySearchResponse;

  const mappedProducts = (json.itemSummaries ?? [])
    .map(mapEbayItem)
    .filter((product): product is EbayProduct => product !== null);

  console.log({
    event: "ebay_api_results_fetched",
    query: input.query,
    totalFromEbay: json.total ?? null,
    returned: mappedProducts.length,
  });

  return mappedProducts;
}