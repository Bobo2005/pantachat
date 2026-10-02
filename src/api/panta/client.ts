import axios, { type AxiosRequestConfig, type AxiosInstance, type AxiosError } from "axios";
import Bottleneck from "bottleneck";
import { config } from "../../config.js";

// =============================================================================
// Standardized Panta API Error Envelope
// =============================================================================

export type PantaErrorCode =
  | "QUOTE_STALE"
  | "RATE_LIMIT_EXCEEDED"
  | "MARKET_NOT_GRADUATED"
  | "TX_NOT_FOUND"
  | "INVALID_CUTOFF"
  | "UNAUTHORIZED"
  | "UNKNOWN_ERROR";

export class PantaApiError extends Error {
  public readonly code: PantaErrorCode | string;
  public readonly statusCode?: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: PantaErrorCode | string = "UNKNOWN_ERROR",
    statusCode?: number,
    details?: unknown
  ) {
    super(message);
    this.name = "PantaApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, PantaApiError.prototype);
  }
}

// =============================================================================
// Rate Limiters (memory.md Strict Quota Invariants)
// =============================================================================

/**
 * Market Read Quota: Strictly 120 req/min.
 * Used for GET /markets/ and GET /markets/{id}/
 */
export const readLimiter = new Bottleneck({
  reservoir: 120,
  reservoirRefreshAmount: 120,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 5,
});

/**
 * Positions Quota: Strictly 60 req/min.
 * Used for checking user balances and winner status via GET /positions/?wallet=
 */
export const positionLimiter = new Bottleneck({
  reservoir: 60,
  reservoirRefreshAmount: 60,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 3,
});

/**
 * Build Quota: Strictly 20 req/min.
 * CRITICAL INVARIANT: NEVER violate this!
 * Used for POST /primaryorderbuild/, POST /markets/create/build/,
 * POST /claim/build/, POST /claim/creator-fees/build/
 */
export const buildLimiter = new Bottleneck({
  reservoir: 20,
  reservoirRefreshAmount: 20,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 1, // Enforce serialized builds to prevent bursting
});

export type LimiterType = "read" | "position" | "build" | "none";

function getLimiter(type: LimiterType): Bottleneck | null {
  switch (type) {
    case "read":
      return readLimiter;
    case "position":
      return positionLimiter;
    case "build":
      return buildLimiter;
    case "none":
    default:
      return null;
  }
}

// =============================================================================
// Axios Instance & Interceptors
// =============================================================================

export const pantaAxios: AxiosInstance = axios.create({
  baseURL: config.PANTA_API_BASE_URL,
  headers: {
    Authorization: `Bearer ${config.PANTA_API_KEY}`,
    "X-Api-Key": config.PANTA_API_KEY,
    "Content-Type": "application/json",
  },
  timeout: 20000,
});

// Response interceptor for standardized error handling
pantaAxios.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ code?: string; message?: string; error?: string; details?: unknown }>) => {
    if (error.response) {
      const { status, data } = error.response;
      let rawCode = data?.code || (typeof data?.error === "string" ? data.error : "");
      let rawMessage = data?.message || (typeof data?.error === "string" ? data.error : error.message);

      let code: PantaErrorCode | string = rawCode || "UNKNOWN_ERROR";

      if (status === 429) {
        code = "RATE_LIMIT_EXCEEDED";
        rawMessage = rawMessage || "Panta rate limit exceeded. Request throttled.";
      } else if (rawCode === "QUOTE_STALE" || rawMessage.includes("QUOTE_STALE")) {
        code = "QUOTE_STALE";
      } else if (rawCode === "MARKET_NOT_GRADUATED" || rawMessage.includes("MARKET_NOT_GRADUATED")) {
        code = "MARKET_NOT_GRADUATED";
      } else if (rawCode === "TX_NOT_FOUND" || rawMessage.includes("TX_NOT_FOUND")) {
        code = "TX_NOT_FOUND";
      } else if (rawCode === "INVALID_CUTOFF" || rawMessage.includes("INVALID_CUTOFF")) {
        code = "INVALID_CUTOFF";
      } else if (status === 401 || status === 403) {
        code = "UNAUTHORIZED";
      }

      return Promise.reject(new PantaApiError(rawMessage, code, status, data?.details || data));
    }

    return Promise.reject(new PantaApiError(error.message, "UNKNOWN_ERROR"));
  }
);

// =============================================================================
// Rate-Limited HTTP Helpers
// =============================================================================

/**
 * Performs a rate-limited GET request to the Panta API.
 */
export async function pantaGet<T = unknown>(
  url: string,
  requestConfig?: AxiosRequestConfig,
  limiterType: LimiterType = "read"
): Promise<T> {
  const limiter = getLimiter(limiterType);
  if (limiter) {
    const res = await limiter.schedule(() => pantaAxios.get<T>(url, requestConfig));
    return res.data;
  }
  const res = await pantaAxios.get<T>(url, requestConfig);
  return res.data;
}

/**
 * Performs a rate-limited POST request to the Panta API.
 */
export async function pantaPost<T = unknown>(
  url: string,
  data?: unknown,
  requestConfig?: AxiosRequestConfig,
  limiterType: LimiterType = "build"
): Promise<T> {
  const limiter = getLimiter(limiterType);
  if (limiter) {
    const res = await limiter.schedule(() => pantaAxios.post<T>(url, data, requestConfig));
    return res.data;
  }
  const res = await pantaAxios.post<T>(url, data, requestConfig);
  return res.data;
}
