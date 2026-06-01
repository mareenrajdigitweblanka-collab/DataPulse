import type { GoogleFilters } from "../jobs/jobs.schema.js";
import type { GoogleShoppingProduct } from "../scrapers/google-shopping.scraper.js";

export type GoogleFilterSummary = {
  totalScraped: number;
  totalFiltered: number;
  filtersApplied: string[];
};

function includesIgnoreCase(value: string | null, search: string | undefined) {
  if (!search || search.trim() === "") return true;

  return (value ?? "").toLowerCase().includes(search.trim().toLowerCase());
}

export function filterGoogleShoppingProducts(input: {
  products: GoogleShoppingProduct[];
  filters: GoogleFilters;
}) {
  const filtersApplied: string[] = [];

  const {
    minPrice,
    maxPrice,
    storeName = "",
    inStockOnly = false,
  } = input.filters;

  if (typeof minPrice === "number") filtersApplied.push("Minimum Price");
  if (typeof maxPrice === "number") filtersApplied.push("Maximum Price");
  if (storeName.trim()) filtersApplied.push("Store Name");
  if (inStockOnly) filtersApplied.push("In Stock Only");

  const filteredProducts = input.products.filter((product) => {
    if (typeof minPrice === "number") {
      if (product.price === null || product.price < minPrice) return false;
    }

    if (typeof maxPrice === "number") {
      if (product.price === null || product.price > maxPrice) return false;
    }

    if (!includesIgnoreCase(product.storeName, storeName)) {
      return false;
    }

    /**
     * Unknown stock status should fail only when user explicitly requires stock.
     */
    if (inStockOnly && product.isInStock !== true) {
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