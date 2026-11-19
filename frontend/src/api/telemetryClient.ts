import type {
  ApiErrorBody,
  Paginated,
  SortField,
  SortOrder,
  Telemetry,
  TelemetryInput,
  TelemetryStatus,
  TelemetrySummary,
} from '@telemetry/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export class NetworkError extends Error {
  constructor(message = "Can't reach the telemetry API. Check that the backend is running.") {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ListParams {
  satelliteId?: string;
  status?: TelemetryStatus | '';
  sortBy?: SortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

export function buildUrl(path: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new NetworkError();
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (res.ok) return body as T;

  const error = (body as ApiErrorBody | null)?.error;
  // A 5xx without our JSON error shape comes from the proxy (nginx / vite), which
  // means the API itself is down. Treat it the same as a failed fetch.
  if (!error && res.status >= 500) throw new NetworkError();

  const fieldErrors = Object.fromEntries((error?.details ?? []).map((d) => [d.field, d.message]));
  throw new ApiError(
    res.status,
    error?.code ?? 'HTTP_ERROR',
    error?.message ?? `Request failed with status ${res.status}`,
    fieldErrors,
  );
}

export const telemetryApi = {
  list: (params: ListParams = {}) =>
    request<Paginated<Telemetry>>(buildUrl('/telemetry', { ...params })),

  summary: () => request<TelemetrySummary>(buildUrl('/telemetry/summary')),

  create: (input: TelemetryInput) =>
    request<Telemetry>(buildUrl('/telemetry'), { method: 'POST', body: JSON.stringify(input) }),

  remove: (id: string) =>
    request<void>(buildUrl(`/telemetry/${encodeURIComponent(id)}`), { method: 'DELETE' }),
};

export type TelemetryApi = typeof telemetryApi;
