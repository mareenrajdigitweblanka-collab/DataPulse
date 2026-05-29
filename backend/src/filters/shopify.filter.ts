import type { ShopifyFilters } from "../jobs/jobs.schema.js";
import type { ShopifyProduct } from "../scrapers/shopify.scraper.js";

export type FilterSummary = {
  totalScraped: number;
  totalFiltered: number;
  filtersApplied: string[];
};

function includesIgnoreCase(value: string | null, search: string | undefined) {
  if (!search || search.trim() === "") return true;

  return (value ?? "").toLowerCase().includes(search.trim().toLowerCase());
}

/**
 * Pure filter function.
 * No DB. No HTTP. Easy to unit test.
 */
export function filterShopifyProducts(input: {
  products: ShopifyProduct[];
  filters: ShopifyFilters;
}) {
  const filtersApplied: string[] = [];

  const {
    minPrice,
    maxPrice,
    inStockOnly = false,
    vendor = "",
    productType = "",
  } = input.filters;

  if (typeof minPrice === "number") filtersApplied.push("Minimum Price");
  if (typeof maxPrice === "number") filtersApplied.push("Maximum Price");
  if (inStockOnly) filtersApplied.push("In Stock Only");
  if (vendor.trim()) filtersApplied.push("Vendor");
  if (productType.trim()) filtersApplied.push("Product Type");

  const filteredProducts = input.products.filter((product) => {
    /**
     * If price is missing, exclude only when price filters are active.
     */
    if (typeof minPrice === "number") {
      if (product.price === null || product.price < minPrice) return false;
    }

    if (typeof maxPrice === "number") {
      if (product.price === null || product.price > maxPrice) return false;
    }

    if (inStockOnly && product.isAvailable === false) {
      return false;
    }

    if (!includesIgnoreCase(product.vendor, vendor)) {
      return false;
    }

    if (!includesIgnoreCase(product.productType, productType)) {
      return false;
    }

    return true;
  });

  const summary: FilterSummary = {
    totalScraped: input.products.length,
    totalFiltered: filteredProducts.length,
    filtersApplied,
  };

  return {
    filteredProducts,
    summary,
  };
}