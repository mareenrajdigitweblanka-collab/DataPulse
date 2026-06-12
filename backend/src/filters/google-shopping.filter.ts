import type { GoogleFilters } from "../jobs/jobs.schema.js";
import type { GoogleShoppingProduct } from "../scrapers/google-shopping.scraper.js";

export type GoogleFilterSummary = {
  totalScraped: number;
  totalFiltered: number;
  filtersApplied: string[];
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

export function filterGoogleShoppingProducts(input: {
  products: GoogleShoppingProduct[];
  filters: GoogleFilters;
}) {
  const { filters } = input;
  const filtersApplied: string[] = [];

  const minPrice = filters.minPrice;
  const maxPrice = filters.maxPrice;
  const storeName = filters.storeName ?? "";
  const inStockOnly = filters.inStockOnly ?? false;

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

  const filteredProducts = input.products.filter((product) => {
    if (!hasValidPriceForMinMax(product, minPrice, maxPrice)) return false;
    if (!includesIgnoreCase(product.storeName, storeName)) return false;
    if (!matchesStockRequirement(product, inStockOnly)) return false;

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
