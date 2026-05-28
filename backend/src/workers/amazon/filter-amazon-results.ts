import type { AmazonProduct } from "./fake-amazon-data.js";

export type AmazonFilters = {
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  minRating?: number;
  minReviewCount?: number;
  primeOnly?: boolean;
};

/**
 * Filter Amazon products based on user-provided filters.
 */
export function filterAmazonResults(
  products: AmazonProduct[],
  filters: AmazonFilters
): AmazonProduct[] {
  return products.filter((product) => {
    // Price filters
    if (filters.minPrice !== undefined && product.price < filters.minPrice) {
      return false;
    }
    if (filters.maxPrice !== undefined && product.price > filters.maxPrice) {
      return false;
    }

    // Stock filter
    if (filters.inStockOnly && !product.inStock) {
      return false;
    }

    // Rating filter
    if (filters.minRating !== undefined && product.rating < filters.minRating) {
      return false;
    }

    // Review count filter
    if (
      filters.minReviewCount !== undefined &&
      product.reviewCount < filters.minReviewCount
    ) {
      return false;
    }

    // Prime filter
    if (filters.primeOnly && !product.isPrime) {
      return false;
    }

    return true;
  });
}