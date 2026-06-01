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
    condition = "any",
    freeShippingOnly = false,
    buyItNowOnly = false,
  } = input.filters;

  if (typeof minPrice === "number") filtersApplied.push("Minimum Price");
  if (typeof maxPrice === "number") filtersApplied.push("Maximum Price");
  if (condition !== "any") filtersApplied.push("Condition");
  if (freeShippingOnly) filtersApplied.push("Free Shipping Only");
  if (buyItNowOnly) filtersApplied.push("Buy It Now Only");

  const filteredProducts = input.products.filter((product) => {
    if (typeof minPrice === "number") {
      if (product.price === null || product.price < minPrice) return false;
    }

    if (typeof maxPrice === "number") {
      if (product.price === null || product.price > maxPrice) return false;
    }

    if (!conditionMatches(product.condition, condition)) {
      return false;
    }

    if (freeShippingOnly && !product.isFreeShipping) {
      return false;
    }

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