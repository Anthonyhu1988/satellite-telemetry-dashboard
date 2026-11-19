import { z } from 'zod';

// The brief only gives "healthy" and "critical" as examples. I added "warning" because
// a two-state health model is too coarse for real ops, and kept it a closed list so
// the status filter actually means something.
export const STATUSES = ['healthy', 'warning', 'critical'] as const;
export type TelemetryStatus = (typeof STATUSES)[number];

export const SORT_FIELDS = ['timestamp', 'altitude', 'velocity', 'satelliteId', 'status'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = 'asc' | 'desc';

const positiveNumber = (field: string) =>
  z
    .number({
      required_error: `${field} is required`,
      invalid_type_error: `${field} must be a number`,
    })
    .finite(`${field} must be a finite number`)
    .positive(`${field} must be a positive number`);

export const statusSchema = z
  .string({ required_error: 'status is required' })
  .trim()
  .toLowerCase()
  .pipe(
    z.enum(STATUSES, {
      errorMap: () => ({ message: `status must be one of: ${STATUSES.join(', ')}` }),
    }),
  );

// Same schema runs in the browser (form validation) and on the server, so the two can't drift.
export const telemetryInputSchema = z
  .object({
    satelliteId: z
      .string({ required_error: 'satelliteId is required' })
      .trim()
      .min(1, 'satelliteId is required')
      .max(64, 'satelliteId must be 64 characters or less'),
    // offset: true accepts "Z" or "+02:00". A timestamp without a zone is ambiguous
    // for ground station data, so those get rejected.
    timestamp: z
      .string({ required_error: 'timestamp is required' })
      .datetime({
        offset: true,
        message: 'timestamp must be an ISO 8601 datetime, e.g. 2026-01-01T12:00:00Z',
      })
      // the regex happily accepts Feb 30th. pipe so this only runs once the format is ok
      .pipe(
        z
          .string()
          .refine((value) => !Number.isNaN(Date.parse(value)), 'timestamp is not a real date'),
      ),
    altitude: positiveNumber('altitude'),
    velocity: positiveNumber('velocity'),
    status: statusSchema,
  })
  .strict();

export type TelemetryInput = z.infer<typeof telemetryInputSchema>;

export interface Telemetry extends TelemetryInput {
  id: string;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface TelemetrySummary {
  total: number;
  byStatus: Record<TelemetryStatus, number>;
  satellites: string[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}
