import type { AmazonFilters } from "../jobs/jobs.schema.js";
import type { AmazonProduct } from "../scrapers/amazon.scraper.js";

export type AmazonFilterSummary = {
  totalScraped: number;
  totalFiltered: number;
  filtersApplied: string[];
};

export function filterAmazonProducts(input: {
  products: AmazonProduct[];
  filters: AmazonFilters;
}) {
  const filtersApplied: string[] = [];

  const {
    minPrice,
    maxPrice,
    inStockOnly = false,
    minRating,
    minReviewCount,
    primeOnly = false,
    excludeSponsored = false,
  } = input.filters;

  if (typeof minPrice === "number") filtersApplied.push("Minimum Price");
  if (typeof maxPrice === "number") filtersApplied.push("Maximum Price");
  if (inStockOnly) filtersApplied.push("In Stock Only");
  if (typeof minRating === "number") filtersApplied.push("Minimum Rating");
  if (typeof minReviewCount === "number") filtersApplied.push("Minimum Review Count");
  if (primeOnly) filtersApplied.push("Prime Only");
  if (excludeSponsored) filtersApplied.push("Exclude Sponsored");

  const filteredProducts = input.products.filter((product) => {
    if (typeof minPrice === "number") {
      if (product.price === null || product.price < minPrice) return false;
    }

    if (typeof maxPrice === "number") {
      if (product.price === null || product.price > maxPrice) return false;
    }

    if (inStockOnly && product.isAvailable !== true) {
      return false;
    }

    if (typeof minRating === "number") {
      if (product.rating === null || product.rating < minRating) return false;
    }

    if (typeof minReviewCount === "number") {
      if (product.reviewCount === null || product.reviewCount < minReviewCount) {
        return false;
      }
    }

    if (primeOnly && product.isPrime !== true) {
      return false;
    }

    if (excludeSponsored && product.isSponsored === true) {
      return false;
    }

    return true;
  });

  const summary: AmazonFilterSummary = {
    totalScraped: input.products.length,
    totalFiltered: filteredProducts.length,
    filtersApplied,
  };

  return {
    filteredProducts,
    summary,
  };
}