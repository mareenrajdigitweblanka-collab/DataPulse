import type { GoogleFilters } from "../jobs/jobs.schema.js";
import type { GoogleShoppingProduct } from "../scrapers/google-shopping.scraper.js";

export type GoogleFilterSummary = {
  totalScraped: number;
  totalFiltered: number;
  filtersApplied: string[];
};

/**
 * Extra optional filters.
 *
 * Your current GoogleFilters schema may not include all of these yet.
 * This keeps the filter file future-ready without breaking the current code.
 *
 * Later, you can add these to googleFiltersSchema if needed:
 * - minRating
 * - minReviewCount
 * - freeShippingOnly
 * - multipleSourcesOnly
 */
type ExtendedGoogleFilters = GoogleFilters & {
  minRating?: number;
  minReviewCount?: number;
  freeShippingOnly?: boolean;
  multipleSourcesOnly?: boolean;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function includesIgnoreCase(value: string | null, search: string | undefined) {
  const cleanSearch = normalizeText(search);

  if (cleanSearch === "") return true;

  return normalizeText(value).includes(cleanSearch);
}

function hasFreeShipping(product: GoogleShoppingProduct) {
  const deliveryText = normalizeText(product.delivery);

  return (
    deliveryText.includes("free delivery") ||
    deliveryText.includes("free shipping") ||
    deliveryText.includes("free pickup")
  );
}

function hasValidPriceForMinMax(
  product: GoogleShoppingProduct,
  minPrice: number | undefined,
  maxPrice: number | undefined
) {
  const hasMinPrice = isFiniteNumber(minPrice);
  const hasMaxPrice = isFiniteNumber(maxPrice);

  if (!hasMinPrice && !hasMaxPrice) return true;

  /**
   * If user applies price filters, products without numeric price
   * should be removed because we cannot verify them.
   */
  if (!isFiniteNumber(product.price)) return false;

  if (hasMinPrice && product.price < minPrice) return false;
  if (hasMaxPrice && product.price > maxPrice) return false;

  return true;
}

function hasEnoughRating(
  product: GoogleShoppingProduct,
  minRating: number | undefined
) {
  if (!isFiniteNumber(minRating)) return true;

  /**
   * If user asks for minimum rating, unknown rating should fail.
   */
  if (!isFiniteNumber(product.rating)) return false;

  return product.rating >= minRating;
}

function hasEnoughReviews(
  product: GoogleShoppingProduct,
  minReviewCount: number | undefined
) {
  if (!isFiniteNumber(minReviewCount)) return true;

  /**
   * If user asks for minimum review count, unknown reviews should fail.
   */
  if (!isFiniteNumber(product.reviews)) return false;

  return product.reviews >= minReviewCount;
}

function matchesStockRequirement(
  product: GoogleShoppingProduct,
  inStockOnly: boolean
) {
  if (!inStockOnly) return true;

  /**
   * Google Shopping often returns unknown stock status.
   * If user explicitly asks "in stock only", unknown should fail.
   */
  return product.isInStock === true;
}

function matchesFreeShippingRequirement(
  product: GoogleShoppingProduct,
  freeShippingOnly: boolean
) {
  if (!freeShippingOnly) return true;

  return hasFreeShipping(product);
}

function matchesMultipleSourcesRequirement(
  product: GoogleShoppingProduct,
  multipleSourcesOnly: boolean
) {
  if (!multipleSourcesOnly) return true;

  return product.multipleSources === true;
}

export function filterGoogleShoppingProducts(input: {
  products: GoogleShoppingProduct[];
  filters: GoogleFilters;
}) {
  const filters = input.filters as ExtendedGoogleFilters;
  const filtersApplied: string[] = [];

  const minPrice = filters.minPrice;
  const maxPrice = filters.maxPrice;
  const storeName = filters.storeName ?? "";
  const inStockOnly = filters.inStockOnly ?? false;

  const minRating = filters.minRating;
  const minReviewCount = filters.minReviewCount;
  const freeShippingOnly = filters.freeShippingOnly ?? false;
  const multipleSourcesOnly = filters.multipleSourcesOnly ?? false;

  if (isFiniteNumber(minPrice)) {
    filtersApplied.push(`Minimum Price: ${minPrice}`);
  }

  if (isFiniteNumber(maxPrice)) {
    filtersApplied.push(`Maximum Price: ${maxPrice}`);
  }

  if (storeName.trim() !== "") {
    filtersApplied.push(`Store Name: ${storeName.trim()}`);
  }

  if (inStockOnly) {
    filtersApplied.push("In Stock Only");
  }

  if (isFiniteNumber(minRating)) {
    filtersApplied.push(`Minimum Rating: ${minRating}`);
  }

  if (isFiniteNumber(minReviewCount)) {
    filtersApplied.push(`Minimum Review Count: ${minReviewCount}`);
  }

  if (freeShippingOnly) {
    filtersApplied.push("Free Shipping Only");
  }

  if (multipleSourcesOnly) {
    filtersApplied.push("Multiple Sources Only");
  }

  const filteredProducts = input.products.filter((product) => {
    if (!hasValidPriceForMinMax(product, minPrice, maxPrice)) {
      return false;
    }

    if (!includesIgnoreCase(product.storeName, storeName)) {
      return false;
    }

    if (!matchesStockRequirement(product, inStockOnly)) {
      return false;
    }

    if (!hasEnoughRating(product, minRating)) {
      return false;
    }

    if (!hasEnoughReviews(product, minReviewCount)) {
      return false;
    }

    if (!matchesFreeShippingRequirement(product, freeShippingOnly)) {
      return false;
    }

    if (!matchesMultipleSourcesRequirement(product, multipleSourcesOnly)) {
      return false;
    }

    return true;
  });

  const summary: GoogleFilterSummary = {
    totalScraped: input.products.length,
    totalFiltered: filteredProducts.length,
    filtersApplied,
  };

  return {
    filteredProducts,
    summary,
  };
}