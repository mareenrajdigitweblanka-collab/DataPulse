import { env } from "../env.js";
import type { GoogleFilters } from "../jobs/jobs.schema.js";

export type GoogleShoppingProduct = {
  title: string;
  price: number | null;
  currency: string | null;
  storeName: string | null;
  storeUrl: string | null;
  isInStock: boolean | null;
  productUrl: string | null;
  imageUrl: string | null;
  rating: number | null;
  reviews: number | null;
  delivery: string | null;
  position: number | null;
  productId: string | null;
};

type SerpApiShoppingResponse = {
  shopping_results?: SerpApiShoppingResult[];
  inline_shopping_results?: SerpApiShoppingResult[];
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

type SerpApiShoppingResult = {
  position?: number;
  title?: string;
  product_id?: string;
  product_link?: string;
  link?: string;
  direct_link?: string;
  source?: string;
  source_icon?: string;
  price?: string;
  extracted_price?: number;
  rating?: number;
  reviews?: number;
  delivery?: string;
  extensions?: string[];
  thumbnail?: string;
  serpapi_thumbnail?: string;
  tag?: string;
};

function getRequiredSerpApiKey() {
  if (!env.SERPAPI_API_KEY) {
    throw new Error("Missing SERPAPI_API_KEY in root .env");
  }

  return env.SERPAPI_API_KEY;
}

function inferCurrencyFromPrice(price: string | undefined): string | null {
  if (!price) return null;

  if (price.includes("A$")) return "AUD";
  if (price.includes("C$")) return "CAD";
  if (price.includes("$")) return "USD";
  if (price.includes("£")) return "GBP";
  if (price.includes("€")) return "EUR";

  return null;
}

function inferStockStatus(result: SerpApiShoppingResult): boolean | null {
  const text = [
    result.delivery ?? "",
    ...(result.extensions ?? []),
    result.tag ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (text.includes("out of stock")) return false;
  if (text.includes("in stock")) return true;
  if (text.includes("available")) return true;

  return null;
}

function mapGoogleShoppingResult(
  result: SerpApiShoppingResult
): GoogleShoppingProduct | null {
  if (!result.title) return null;

  return {
    title: result.title,
    price:
      typeof result.extracted_price === "number"
        ? result.extracted_price
        : null,
    currency: inferCurrencyFromPrice(result.price),
    storeName: result.source ?? null,

    /**
     * direct_link is often the merchant URL when available.
     * product_link/link may be Google/SerpApi product URLs depending on layout.
     */
    storeUrl: result.direct_link ?? result.link ?? result.product_link ?? null,
    productUrl: result.product_link ?? result.link ?? result.direct_link ?? null,

    isInStock: inferStockStatus(result),
    imageUrl: result.thumbnail ?? result.serpapi_thumbnail ?? null,
    rating: typeof result.rating === "number" ? result.rating : null,
    reviews: typeof result.reviews === "number" ? result.reviews : null,
    delivery: result.delivery ?? null,
    position: typeof result.position === "number" ? result.position : null,
    productId: result.product_id ?? null,
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
      return aPrice - bPrice;
    });
  }

  if (sortBy === "price_desc") {
    sorted.sort((a, b) => {
      const aPrice = a.price ?? Number.NEGATIVE_INFINITY;
      const bPrice = b.price ?? Number.NEGATIVE_INFINITY;
      return bPrice - aPrice;
    });
  }

  if (sortBy === "rating") {
    sorted.sort((a, b) => {
      const aRating = a.rating ?? Number.NEGATIVE_INFINITY;
      const bRating = b.rating ?? Number.NEGATIVE_INFINITY;
      return bRating - aRating;
    });
  }

  return sorted;
}

/**
 * Prevent duplicate products across paginated responses.
 * productId is best when available. Otherwise use title + store + price.
 */
function getProductDedupeKey(product: GoogleShoppingProduct) {
  /**
   * Google Shopping product_id may represent a Google product cluster,
   * not always a unique merchant listing across pages.
   *
   * Use merchant/product URL first when available.
   */
  if (product.productUrl) {
    return `product_url:${product.productUrl}`;
  }

  if (product.storeUrl) {
    return `store_url:${product.storeUrl}`;
  }

  /**
   * Fallback: title + store + price.
   */
  return [
    product.title.trim().toLowerCase(),
    product.storeName ?? "",
    product.price ?? "",
  ].join("|");
}

function buildInitialSerpApiUrl(input: {
  query: string;
  filters: GoogleFilters;
}) {
  const apiKey = getRequiredSerpApiKey();

  const url = new URL("https://serpapi.com/search");

  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", input.query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set(
    "gl",
    input.filters.country ?? env.GOOGLE_SHOPPING_DEFAULT_COUNTRY
  );
  url.searchParams.set(
    "hl",
    input.filters.language ?? env.GOOGLE_SHOPPING_DEFAULT_LANGUAGE
  );

  /**
   * Request page size. SerpApi/Google may still return a different count,
   * so backend also enforces GOOGLE_SHOPPING_SEARCH_LIMIT after mapping.
   */
  url.searchParams.set("num", String(env.GOOGLE_SHOPPING_PAGE_SIZE));
  url.searchParams.set("start", "0");

  return url;
}

function buildOffsetUrl(input: {
  query: string;
  filters: GoogleFilters;
  start: number;
}) {
  const url = buildInitialSerpApiUrl(input);
  url.searchParams.set("start", String(input.start));
  return url;
}

async function fetchSerpApiPage(url: URL) {
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `SerpApi Google Shopping failed with HTTP ${response.status}: ${responseText}`
    );
  }

  const json = JSON.parse(responseText) as SerpApiShoppingResponse;

  if (json.error) {
    throw new Error(`SerpApi Google Shopping error: ${json.error}`);
  }

  return json;
}

function extractShoppingResults(json: SerpApiShoppingResponse) {
  /**
   * Most Google Shopping responses use shopping_results.
   * Some layouts may include inline_shopping_results.
   */
  return [
    ...(json.shopping_results ?? []),
    ...(json.inline_shopping_results ?? []),
  ];
}

// function getNextPaginationUrl(json: SerpApiShoppingResponse) {
//   const next = json.serpapi_pagination?.next ?? json.serpapi_pagination?.next_link;

//   if (!next) return null;

//   try {
//     return new URL(next);
//   } catch {
//     return null;
//   }
// }

function getNextPaginationUrl(json: SerpApiShoppingResponse) {
  const next =
    json.serpapi_pagination?.next ?? json.serpapi_pagination?.next_link;

  if (!next) return null;

  try {
    const nextUrl = new URL(next);

    /**
     * SerpApi pagination URLs can contain a placeholder/demo API key.
     * Always force our real API key from .env before requesting next page.
     */
    nextUrl.searchParams.set("api_key", getRequiredSerpApiKey());

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

    const pageResults = extractShoppingResults(json);

    const mappedPageProducts = pageResults
      .map(mapGoogleShoppingResult)
      .filter((product): product is GoogleShoppingProduct => product !== null);

    let addedFromPage = 0;

    for (const product of mappedPageProducts) {
      const key = getProductDedupeKey(product);

      if (seen.has(key)) continue;

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
      returnedOnPage: mappedPageProducts.length,
      addedFromPage,
      totalCollected: allProducts.length,
      configuredLimit: env.GOOGLE_SHOPPING_SEARCH_LIMIT,
    });

    /**
     * Preferred: follow SerpApi-provided next URL.
     * Fallback: use start offset if next URL is missing but the page had results.
     */
    const serpApiNextUrl = getNextPaginationUrl(json);

    if (serpApiNextUrl) {
      nextUrl = serpApiNextUrl;
    } else if (mappedPageProducts.length > 0) {
      const nextStart = page * env.GOOGLE_SHOPPING_PAGE_SIZE;

      /**
       * Offset fallback. This is less accurate for some newer Google Shopping
       * layouts but still useful when serpapi_pagination.next is absent.
       */
      nextUrl = buildOffsetUrl({
        query: input.query,
        filters: input.filters,
        start: nextStart,
      });
    } else {
      nextUrl = null;
    }

    /**
     * If SerpApi keeps returning pages but all are duplicates, stop early.
     */
    if (mappedPageProducts.length > 0 && addedFromPage === 0) {
      console.log({
        event: "google_shopping_duplicate_page_detected",
        query: input.query,
        page,
        totalCollected: allProducts.length,
      });

      /**
       * Do not stop immediately.
       * SerpApi/Google Shopping pagination may return overlapping pages.
       * Let GOOGLE_SHOPPING_MAX_PAGES control the safety limit.
       */
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
  });

  return sortedProducts;
}