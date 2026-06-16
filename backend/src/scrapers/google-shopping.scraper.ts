import { env } from "../env.js";
import type { GoogleFilters } from "../jobs/jobs.schema.js";

export type GoogleShoppingProduct = {
  platform: "google";

  title: string;
  price: number | null;
  currency: string | null;

  storeName: string | null;
  storeUrl: string | null;
  productUrl: string | null;
  imageUrl: string | null;

  isInStock: boolean | null;

  rating: number | null;
  reviews: number | null;
  delivery: string | null;

  position: number | null;
  productId: string | null;

  sourceIcon: string | null;
  oldPrice: number | null;
  oldPriceText: string | null;
  tag: string | null;
  badge: string | null;
  snippet: string | null;
  extensions: string[];
  secondHandCondition: string | null;
  multipleSources: boolean | null;
};

type SerpApiShoppingResponse = {
  shopping_results?: SerpApiShoppingResult[];
  inline_shopping_results?: SerpApiShoppingResult[];
  categorized_shopping_results?: SerpApiCategorizedShoppingResult[];

  error?: string;

  search_metadata?: {
    id?: string;
    status?: string;
    json_endpoint?: string;
  };

  serpapi_pagination?: {
    current?: number;
    next?: string;
    next_link?: string;
    other_pages?: Record<string, string>;
  };
};

type SerpApiCategorizedShoppingResult = {
  title?: string;
  shopping_results?: SerpApiShoppingResult[];
};

type SerpApiShoppingResult = {
  position?: number;
  title?: string;

  product_id?: string;
  product_link?: string;
  link?: string;
  direct_link?: string;
  tracking_link?: string;

  serpapi_product_api?: string;
  serpapi_immersive_product_api?: string;
  immersive_product_page_token?: string;

  source?: string;
  source_icon?: string;

  price?: string;
  extracted_price?: number;

  old_price?: string;
  extracted_old_price?: number;

  alternative_price?: {
    price?: string;
    extracted_price?: number;
    currency?: string;
  };

  rating?: number;
  reviews?: number;

  delivery?: string;
  shipping?: string;
  snippet?: string;

  extensions?: string[];

  thumbnail?: string;
  thumbnails?: string[];
  serpapi_thumbnail?: string;
  serpapi_thumbnails?: string[];

  tag?: string;
  badge?: string;
  second_hand_condition?: string;
  multiple_sources?: boolean;
};

const SERPAPI_BASE_URL = "https://serpapi.com/search.json";

const COUNTRY_TO_GOOGLE_DOMAIN: Record<string, string> = {
  us: "google.com",
  gb: "google.co.uk",
  ca: "google.ca",
  au: "google.com.au",
  de: "google.de",
  fr: "google.fr",
  in: "google.co.in",
  jp: "google.co.jp",
  it: "google.it",
  es: "google.es",
  nl: "google.nl",
  br: "google.com.br",
  mx: "google.com.mx",
};

const COUNTRY_TO_LOCATION: Record<string, string> = {
  us: "United States",
  gb: "United Kingdom",
  ca: "Canada",
  au: "Australia",
  de: "Germany",
  fr: "France",
  in: "India",
  jp: "Japan",
  it: "Italy",
  es: "Spain",
  nl: "Netherlands",
  br: "Brazil",
  mx: "Mexico",
};

/**
 * Per-page timeout.
 *
 * The worker already has a full-job timeout.
 * This protects one SerpApi page request from hanging too long.
 */
const SERPAPI_PAGE_TIMEOUT_MS = 90 * 1000;

/**
 * SerpApi reports an empty result set via the `error` field rather than an
 * empty array. These messages are not real failures — they mean Google simply
 * had nothing for this query/page in this region.
 */
function isNoResultsError(serpApiError: string) {
  const normalized = serpApiError.toLowerCase();

  return (
    normalized.includes("hasn't returned any results") ||
    normalized.includes("has not returned any results") ||
    normalized.includes("no results found") ||
    normalized.includes("google hasn't returned any results")
  );
}

function getRequiredSerpApiKey() {
  if (!env.SERPAPI_API_KEY) {
    throw new Error("Missing SERPAPI_API_KEY in root .env");
  }

  return env.SERPAPI_API_KEY;
}

function parsePriceText(value: string | undefined | null) {
  if (!value) return null;

  const cleaned = value.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const parsed = Number.parseFloat(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

function inferCurrencyFromPrice(price: string | undefined | null) {
  if (!price) return null;

  if (price.includes("A$")) return "AUD";
  if (price.includes("C$")) return "CAD";
  if (price.includes("NZ$")) return "NZD";
  if (price.includes("$")) return "USD";
  if (price.includes("£")) return "GBP";
  if (price.includes("€")) return "EUR";
  if (price.includes("₹")) return "INR";
  if (price.includes("¥")) return "JPY";

  return null;
}

function inferStockStatus(result: SerpApiShoppingResult): boolean | null {
  const text = [
    result.delivery ?? "",
    result.shipping ?? "",
    result.snippet ?? "",
    result.tag ?? "",
    result.badge ?? "",
    result.second_hand_condition ?? "",
    ...(result.extensions ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (text.includes("out of stock")) return false;
  if (text.includes("sold out")) return false;
  if (text.includes("unavailable")) return false;

  if (text.includes("in stock")) return true;
  if (/\bavailable\b/.test(text) && !text.includes("unavailable")) return true;
  if (text.includes("available to buy")) return true;
  if (text.includes("available now")) return true;
  if (text.includes("get it today")) return true;
  if (text.includes("free delivery")) return true;
  if (text.includes("free shipping")) return true;

  return null;
}

function getBestImageUrl(result: SerpApiShoppingResult) {
  return (
    result.thumbnail ??
    result.serpapi_thumbnail ??
    result.thumbnails?.[0] ??
    result.serpapi_thumbnails?.[0] ??
    null
  );
}

function getBestStoreUrl(result: SerpApiShoppingResult) {
  return (
    result.direct_link ??
    result.link ??
    result.tracking_link ??
    null
  );
}

function getBestProductUrl(result: SerpApiShoppingResult) {
  return (
    result.product_link ??
    result.link ??
    result.direct_link ??
    result.tracking_link ??
    null
  );
}

function getMainPrice(result: SerpApiShoppingResult) {
  if (typeof result.extracted_price === "number") {
    return result.extracted_price;
  }

  if (typeof result.alternative_price?.extracted_price === "number") {
    return result.alternative_price.extracted_price;
  }

  return parsePriceText(result.price ?? result.alternative_price?.price);
}

function getOldPrice(result: SerpApiShoppingResult) {
  if (typeof result.extracted_old_price === "number") {
    return result.extracted_old_price;
  }

  return parsePriceText(result.old_price);
}

function getCurrency(result: SerpApiShoppingResult) {
  return (
    inferCurrencyFromPrice(result.price) ??
    result.alternative_price?.currency ??
    inferCurrencyFromPrice(result.alternative_price?.price) ??
    inferCurrencyFromPrice(result.old_price)
  );
}

function mapGoogleShoppingResult(
  result: SerpApiShoppingResult
): GoogleShoppingProduct | null {
  if (!result.title || result.title.trim() === "") {
    return null;
  }

  return {
    platform: "google",

    title: result.title.trim(),
    price: getMainPrice(result),
    currency: getCurrency(result),

    storeName: result.source ?? null,
    storeUrl: getBestStoreUrl(result),
    productUrl: getBestProductUrl(result),
    imageUrl: getBestImageUrl(result),

    isInStock: inferStockStatus(result),

    rating: typeof result.rating === "number" ? result.rating : null,
    reviews: typeof result.reviews === "number" ? result.reviews : null,
    delivery: result.delivery ?? result.shipping ?? null,

    position: typeof result.position === "number" ? result.position : null,
    productId: result.product_id ?? null,

    sourceIcon: result.source_icon ?? null,
    oldPrice: getOldPrice(result),
    oldPriceText: result.old_price ?? null,
    tag: result.tag ?? null,
    badge: result.badge ?? null,
    snippet: result.snippet ?? null,
    extensions: result.extensions ?? [],
    secondHandCondition: result.second_hand_condition ?? null,
    multipleSources:
      typeof result.multiple_sources === "boolean"
        ? result.multiple_sources
        : null,
  };
}

function applyLocalSort(
  products: GoogleShoppingProduct[],
  sortBy: GoogleFilters["sortBy"]
) {
  const sorted = [...products];

  if (sortBy === "price_asc") {
    sorted.sort((a, b) => {
      const aPrice = a.price ?? Number.POSITIVE_INFINITY;
      const bPrice = b.price ?? Number.POSITIVE_INFINITY;

      if (aPrice === bPrice) {
        return (a.position ?? 999999) - (b.position ?? 999999);
      }

      return aPrice - bPrice;
    });
  }

  if (sortBy === "price_desc") {
    sorted.sort((a, b) => {
      const aPrice = a.price ?? Number.NEGATIVE_INFINITY;
      const bPrice = b.price ?? Number.NEGATIVE_INFINITY;

      if (aPrice === bPrice) {
        return (a.position ?? 999999) - (b.position ?? 999999);
      }

      return bPrice - aPrice;
    });
  }

  if (sortBy === "rating") {
    sorted.sort((a, b) => {
      const aRating = a.rating ?? Number.NEGATIVE_INFINITY;
      const bRating = b.rating ?? Number.NEGATIVE_INFINITY;

      if (aRating === bRating) {
        const aReviews = a.reviews ?? Number.NEGATIVE_INFINITY;
        const bReviews = b.reviews ?? Number.NEGATIVE_INFINITY;
        return bReviews - aReviews;
      }

      return bRating - aRating;
    });
  }

  return sorted;
}

/**
 * Prevent duplicate products across paginated responses.
 *
 * For maximum output, avoid using productId alone because Google product_id can
 * represent a product cluster, not always one merchant listing.
 */
function getProductDedupeKey(product: GoogleShoppingProduct) {
  if (product.storeUrl) {
    return `store_url:${product.storeUrl}`;
  }

  if (product.productUrl) {
    return [
      "product_url",
      product.productUrl,
      product.storeName ?? "",
      product.price ?? "",
    ].join("|");
  }

  if (product.productId) {
    return [
      "product_id",
      product.productId,
      product.storeName ?? "",
      product.price ?? "",
    ].join("|");
  }

  return [
    "fallback",
    product.title.trim().toLowerCase(),
    product.storeName ?? "",
    product.price ?? "",
  ].join("|");
}

function applyGoogleShoppingApiFilters(url: URL, filters: GoogleFilters) {
  /**
   * SerpApi supports Google Shopping price filters directly.
   * Keep local filters also, because API results can still vary by layout.
   */
  if (typeof filters.minPrice === "number") {
    url.searchParams.set("min_price", String(filters.minPrice));
  }

  if (typeof filters.maxPrice === "number") {
    url.searchParams.set("max_price", String(filters.maxPrice));
  }

  /**
   * SerpApi Google Shopping sort_by:
   * 1 = price low to high
   * 2 = price high to low
   *
   * Rating sort is not a Google Shopping API-level sort in this schema,
   * so rating stays as local post-processing.
   */
  if (filters.sortBy === "price_asc") {
    url.searchParams.set("sort_by", "1");
  }

  if (filters.sortBy === "price_desc") {
    url.searchParams.set("sort_by", "2");
  }
}

function buildInitialSerpApiUrl(input: {
  query: string;
  filters: GoogleFilters;
}) {
  const apiKey = getRequiredSerpApiKey();

  const url = new URL(SERPAPI_BASE_URL);

  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", input.query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("output", "json");

  const countryCode = input.filters.country ?? env.GOOGLE_SHOPPING_DEFAULT_COUNTRY;

  url.searchParams.set("gl", countryCode);

  const googleDomain = COUNTRY_TO_GOOGLE_DOMAIN[countryCode];
  if (googleDomain) {
    url.searchParams.set("google_domain", googleDomain);
  }

  const location = COUNTRY_TO_LOCATION[countryCode];
  if (location) {
    url.searchParams.set("location", location);
  }

  url.searchParams.set(
    "hl",
    input.filters.language ?? env.GOOGLE_SHOPPING_DEFAULT_LANGUAGE
  );

  // Force fresh results — avoids stale "no results" cache entries from prior
  // requests that lacked google_domain/location.
  url.searchParams.set("no_cache", "true");

  /**
   * SerpApi docs focus on start/next pagination.
   * This num value may be ignored by some Google Shopping layouts,
   * but keeping it does not break the request and helps where supported.
   */
  url.searchParams.set("num", String(env.GOOGLE_SHOPPING_PAGE_SIZE));
  url.searchParams.set("start", "0");

  applyGoogleShoppingApiFilters(url, input.filters);

  return url;
}

function buildOffsetFallbackUrl(input: {
  query: string;
  filters: GoogleFilters;
  start: number;
}) {
  const url = buildInitialSerpApiUrl({
    query: input.query,
    filters: input.filters,
  });

  url.searchParams.set("start", String(input.start));

  return url;
}

async function fetchSerpApiPage(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, SERPAPI_PAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        `SerpApi Google Shopping failed with HTTP ${response.status}: ${responseText}`
      );
    }

    let json: SerpApiShoppingResponse;

    try {
      json = JSON.parse(responseText) as SerpApiShoppingResponse;
    } catch {
      throw new Error(
        `SerpApi Google Shopping returned invalid JSON: ${responseText.slice(
          0,
          500
        )}`
      );
    }

    if (json.error) {
      /**
       * SerpApi uses this "error" to signal an empty result set, not a real
       * failure. It happens routinely for thinner-inventory countries and on
       * deep pagination offsets. Treat it as an empty page so the caller can
       * stop paginating and keep whatever it has already collected, instead of
       * throwing and killing the whole job (which then retries 3×).
       */
      if (isNoResultsError(json.error)) {
        console.log({
          event: "google_shopping_no_results",
          serpApiError: json.error,
        });

        return { ...json, shopping_results: [] };
      }

      throw new Error(`SerpApi Google Shopping error: ${json.error}`);
    }

    return json;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `SerpApi Google Shopping page request timed out after ${SERPAPI_PAGE_TIMEOUT_MS / 1000
        } seconds`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractShoppingResults(json: SerpApiShoppingResponse) {
  const normalResults = json.shopping_results ?? [];
  const inlineResults = json.inline_shopping_results ?? [];

  const categorizedResults =
    json.categorized_shopping_results?.flatMap((category) => {
      return category.shopping_results ?? [];
    }) ?? [];

  return [...normalResults, ...inlineResults, ...categorizedResults];
}

function getNextPaginationUrl(json: SerpApiShoppingResponse) {
  const next =
    json.serpapi_pagination?.next ?? json.serpapi_pagination?.next_link;

  if (!next) return null;

  try {
    const nextUrl = new URL(next);

    /**
     * SerpApi pagination URLs can contain a placeholder/demo key
     * or no key depending on response shape.
     * Always force the real key from our .env.
     */
    nextUrl.searchParams.set("api_key", getRequiredSerpApiKey());
    nextUrl.searchParams.set("output", "json");

    return nextUrl;
  } catch {
    return null;
  }
}

export async function fetchGoogleShoppingProducts(input: {
  query: string;
  filters: GoogleFilters;
}) {
  const allProducts: GoogleShoppingProduct[] = [];
  const seen = new Set<string>();

  let page = 1;
  let nextUrl: URL | null = buildInitialSerpApiUrl(input);

  while (
    nextUrl &&
    page <= env.GOOGLE_SHOPPING_MAX_PAGES &&
    allProducts.length < env.GOOGLE_SHOPPING_SEARCH_LIMIT
  ) {
    const json = await fetchSerpApiPage(nextUrl);

    const rawPageResults = extractShoppingResults(json);

    if (rawPageResults.length === 0) {
      console.log({
        event: "google_shopping_empty_page",
        query: input.query,
        page,
        totalCollected: allProducts.length,
      });

      break;
    }

    const mappedPageProducts = rawPageResults
      .map(mapGoogleShoppingResult)
      .filter((product): product is GoogleShoppingProduct => product !== null);

    let addedFromPage = 0;

    for (const product of mappedPageProducts) {
      const key = getProductDedupeKey(product);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      allProducts.push(product);
      addedFromPage += 1;

      if (allProducts.length >= env.GOOGLE_SHOPPING_SEARCH_LIMIT) {
        break;
      }
    }

    console.log({
      event: "google_shopping_page_fetched",
      query: input.query,
      page,
      returnedRaw: rawPageResults.length,
      mappedOnPage: mappedPageProducts.length,
      addedFromPage,
      totalCollected: allProducts.length,
      configuredLimit: env.GOOGLE_SHOPPING_SEARCH_LIMIT,
      maxPages: env.GOOGLE_SHOPPING_MAX_PAGES,
      hasSerpApiNextPage: Boolean(
        json.serpapi_pagination?.next ?? json.serpapi_pagination?.next_link
      ),
      searchMetadataId: json.search_metadata?.id,
      searchStatus: json.search_metadata?.status,
    });

    const serpApiNextUrl = getNextPaginationUrl(json);

    if (serpApiNextUrl) {
      nextUrl = serpApiNextUrl;
    } else if (rawPageResults.length >= env.GOOGLE_SHOPPING_PAGE_SIZE) {
      nextUrl = buildOffsetFallbackUrl({
        query: input.query,
        filters: input.filters,
        start: page * env.GOOGLE_SHOPPING_PAGE_SIZE,
      });
    } else {
      break;
    }

    page += 1;
  }

  const sortedProducts = applyLocalSort(
    allProducts,
    input.filters.sortBy ?? "relevance"
  );

  console.log({
    event: "google_shopping_api_results_fetched",
    query: input.query,
    totalCollected: allProducts.length,
    totalAfterSort: sortedProducts.length,
    configuredLimit: env.GOOGLE_SHOPPING_SEARCH_LIMIT,
    maxPages: env.GOOGLE_SHOPPING_MAX_PAGES,
    country: input.filters.country,
    language: input.filters.language,
    sortBy: input.filters.sortBy,
  });

  return sortedProducts;
}