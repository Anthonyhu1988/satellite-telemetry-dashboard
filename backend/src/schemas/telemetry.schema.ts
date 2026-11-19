import { z } from 'zod';
import { SORT_FIELDS, statusSchema, telemetryInputSchema } from '@telemetry/shared';

export const createTelemetrySchema = telemetryInputSchema;

const positiveInt = (field: string) =>
  z.coerce
    .number({ invalid_type_error: `${field} must be a number` })
    .int(`${field} must be a whole number`)
    .positive(`${field} must be at least 1`);

export const listTelemetryQuerySchema = z.object({
  satelliteId: z.string().trim().min(1).optional(),
  status: statusSchema.optional(),
  page: positiveInt('page').optional(),
  // capped so one request can't pull an unbounded amount of data
  limit: positiveInt('limit').max(100, 'limit must be 100 or less').optional(),
  sortBy: z
    .enum(SORT_FIELDS, {
      errorMap: () => ({ message: `sortBy must be one of: ${SORT_FIELDS.join(', ')}` }),
    })
    .optional(),
  order: z
    .enum(['asc', 'desc'], { errorMap: () => ({ message: 'order must be asc or desc' }) })
    .optional(),
});

export const idParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type ListTelemetryQuery = z.infer<typeof listTelemetryQuerySchema>;
