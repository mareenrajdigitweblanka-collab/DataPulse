export type Channel = "shopify" | "ebay" | "google" | "amazon";

export type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiErrorBody = {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  code?: string;
  message?: string;
  details?: unknown;
};

export type AuthData = {
  user: User;
  token: string;
};

export type MeData = {
  user: User;
};

export type JobStatus =
  | "queued"
  | "running"
  | "filtering"
  | "done"
  | "error"
  | "timeout";

export type Job = {
  id: string;
  userId: string;
  channel: Channel;
  query: string;
  filters: Record<string, unknown>;
  status: JobStatus;
  queuePosition: number | null;
  progressPercent: number;
  totalScraped: number | null;
  totalFiltered: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type CreateJobData = {
  jobId: string;
  status: JobStatus;
  queuePosition: number;
};

export type JobsListData = {
  jobs: Job[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type JobData = {
  job: Job;
};

export type ResultRow = {
  id: string;
  position: number;
  data: Record<string, unknown>;
};

export type ResultsSortBy = "position" | "price_asc" | "price_desc";

export type ResultsData = {
  jobId: string;
  status: JobStatus;
  totalScraped: number | null;
  totalFiltered: number | null;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  results: ResultRow[];
};

export type ShopifyJobPayload = {
  channel: "shopify";
  query?: string;
  filters: {
    storeUrl: string;
    minPrice?: number;
    maxPrice?: number;
    inStockOnly?: boolean;
    vendor?: string;
    productType?: string;
  };
};

export type EbayJobPayload = {
  channel: "ebay";
  query: string;
  filters: {
    minPrice?: number;
    maxPrice?: number;
    condition?: "any" | "new" | "used" | "refurbished";
    freeShippingOnly?: boolean;
    buyItNowOnly?: boolean;
  };
};

export type GoogleJobPayload = {
  channel: "google";
  query: string;
  filters: {
    minPrice?: number;
    maxPrice?: number;
    country?: "us" | "uk" | "ca" | "au" | "de";
    language?: string;
    sortBy?: "relevance" | "price_asc" | "price_desc" | "rating";
    storeName?: string;
    inStockOnly?: boolean;
  };
};

export type AmazonJobPayload = {
  channel: "amazon";
  query: string;
  filters: {
    minPrice?: number;
    maxPrice?: number;
    inStockOnly?: boolean;
    minRating?: number;
    minReviewCount?: number;
    primeOnly?: boolean;
  };
};

export type CreateJobPayload =
  | ShopifyJobPayload
  | EbayJobPayload
  | GoogleJobPayload
  | AmazonJobPayload;