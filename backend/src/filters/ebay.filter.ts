import type { EbayFilters } from "../jobs/jobs.schema.js";
import type { EbayProduct } from "../scrapers/ebay.scraper.js";

export type EbayFilterSummary = {
  totalScraped: number;
  totalFiltered: number;
  filtersApplied: string[];
};

function normalize(value: string | null) {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Local condition matcher.
 *
 * eBay condition values can vary depending on category and marketplace.
 * For MVP, we match using simple readable text checks.
 */
function conditionMatches(productCondition: string | null, filter: string) {
  if (filter === "any") return true;

  const condition = normalize(productCondition);

  if (filter === "new") {
    return condition.includes("new");
  }

  if (filter === "used") {
    return condition.includes("used") || condition.includes("pre-owned");
  }

  if (filter === "refurbished") {
    return condition.includes("refurbished");
  }

  return true;
}

export function filterEbayProducts(input: {
  products: EbayProduct[];
  filters: EbayFilters;
}) {
  const filtersApplied: string[] = [];

  const {
    minPrice,
    maxPrice,
    inStockOnly = false,
    condition = "any",
    freeShippingOnly = false,
    buyItNowOnly = false,
  } = input.filters;

  if (typeof minPrice === "number") filtersApplied.push("Minimum Price");
  if (typeof maxPrice === "number") filtersApplied.push("Maximum Price");
  if (inStockOnly) filtersApplied.push("In Stock Only");
  if (condition !== "any") filtersApplied.push("Condition");
  if (freeShippingOnly) filtersApplied.push("Free Shipping Only");
  if (buyItNowOnly) filtersApplied.push("Buy It Now Only");

  const filteredProducts = input.products.filter((product) => {
    /**
     * Universal filter: minimum price.
     */
    if (typeof minPrice === "number") {
      if (product.price === null || product.price < minPrice) return false;
    }

    /**
     * Universal filter: maximum price.
     */
    if (typeof maxPrice === "number") {
      if (product.price === null || product.price > maxPrice) return false;
    }

    /**
     * Universal filter: in stock only.
     *
     * Current eBay Browse API mapping treats returned active listings as available.
     * This still keeps the filter contract aligned with other channels.
     */
    if (inStockOnly && !product.isAvailable) {
      return false;
    }

    /**
     * eBay-specific filter: condition.
     */
    if (!conditionMatches(product.condition, condition)) {
      return false;
    }

    /**
     * eBay-specific filter: free shipping.
     */
    if (freeShippingOnly && !product.isFreeShipping) {
      return false;
    }

    /**
     * eBay-specific filter: Buy It Now / fixed price only.
     */
    if (buyItNowOnly && product.listingType !== "BIN") {
      return false;
    }

    return true;
  });

  const summary: EbayFilterSummary = {
    totalScraped: input.products.length,
    totalFiltered: filteredProducts.length,
    filtersApplied,
  };

  return {
    filteredProducts,
    summary,
  };
}