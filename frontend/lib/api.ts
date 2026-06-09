import type {
  ApiErrorBody,
  ApiSuccess,
  AuthData,
  CreateJobData,
  CreateJobPayload,
  JobData,
  JobsListData,
  MeData,
  ResultsData,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

export class ApiClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(input: {
    status: number;
    message: string;
    code?: string;
    details?: unknown;
  }) {
    super(input.message);
    this.name = "ApiClientError";
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const json = (await response.json().catch(() => null)) as
    | ApiErrorBody
    | null;

  if (!response.ok) {
    const message =
      json?.error?.message ||
      json?.message ||
      `Request failed with status ${response.status}`;

    throw new ApiClientError({
      status: response.status,
      message,
      code: json?.error?.code || json?.code,
      details: json?.error?.details || json?.details,
    });
  }

  return json as T;
}

export const api = {
  /* ─── Auth ─── */

  register(input: { name: string; email: string; password: string }) {
    return request<ApiSuccess<AuthData>>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  login(input: { email: string; password: string }) {
    return request<ApiSuccess<AuthData>>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  me(token: string) {
    return request<ApiSuccess<MeData>>("/auth/me", {
      method: "GET",
      token,
    });
  },

  forgotPassword(input: { email: string }) {
    return request<
      ApiSuccess<{ message: string; resetToken: string | null }>
    >("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  resetPassword(input: { token: string; password: string }) {
    return request<ApiSuccess<{ message: string }>>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  deleteAccount(token: string) {
    return request<ApiSuccess<{ message: string }>>("/auth/account", {
      method: "DELETE",
      token,
    });
  },

  /* ─── Jobs ─── */

  createJob(token: string, payload: CreateJobPayload) {
    return request<ApiSuccess<CreateJobData>>("/jobs", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },

  listJobs(token: string, page = 1, limit = 7) {
    return request<ApiSuccess<JobsListData>>(
      `/jobs?page=${page}&limit=${limit}`,
      {
        method: "GET",
        token,
      }
    );
  },

  getJob(token: string, jobId: string) {
    return request<ApiSuccess<JobData>>(`/jobs/${jobId}`, {
      method: "GET",
      token,
    });
  },

  getResults(
    token: string,
    jobId: string,
    page = 1,
    limit = 40,
    sortBy: "position" | "price_asc" | "price_desc" = "position"
  ) {
    return request<ApiSuccess<ResultsData>>(
      `/jobs/${jobId}/results?page=${page}&limit=${limit}&sortBy=${sortBy}`,
      {
        method: "GET",
        token,
      }
    );
  },
  
  deleteJob(token: string, jobId: string) {
    return request<ApiSuccess<{ message: string; jobId: string }>>(
      `/jobs/${jobId}`,
      {
        method: "DELETE",
        token,
      }
    );
  },
};