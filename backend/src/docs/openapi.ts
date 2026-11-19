import { SORT_FIELDS, STATUSES } from '@telemetry/shared';

const telemetryInput = {
  type: 'object',
  required: ['satelliteId', 'timestamp', 'altitude', 'velocity', 'status'],
  additionalProperties: false,
  properties: {
    satelliteId: { type: 'string', example: 'SAT-001' },
    timestamp: { type: 'string', format: 'date-time', example: '2026-11-18T10:00:00Z' },
    altitude: { type: 'number', exclusiveMinimum: 0, description: 'km', example: 550 },
    velocity: { type: 'number', exclusiveMinimum: 0, description: 'km/s', example: 7.59 },
    status: { type: 'string', enum: [...STATUSES], example: 'healthy' },
  },
};

const telemetry = {
  allOf: [
    { $ref: '#/components/schemas/TelemetryInput' },
    {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  ],
};

const error = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            properties: { field: { type: 'string' }, message: { type: 'string' } },
          },
        },
      },
    },
  },
};

const json = (schema: object) => ({ 'application/json': { schema } });
const errorResponse = (description: string) => ({
  description,
  content: json({ $ref: '#/components/schemas/Error' }),
});
const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Satellite Telemetry API',
    version: '1.0.0',
    description: 'In-memory store for satellite telemetry. Data resets when the server restarts.',
  },
  paths: {
    '/telemetry': {
      get: {
        summary: 'List telemetry',
        description: 'Returns all matching entries. Pass page and/or limit to paginate.',
        parameters: [
          { name: 'satelliteId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: [...STATUSES] } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          {
            name: 'sortBy',
            in: 'query',
            schema: { type: 'string', enum: [...SORT_FIELDS], default: 'timestamp' },
          },
          {
            name: 'order',
            in: 'query',
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        ],
        responses: {
          200: {
            description: 'Telemetry list',
            content: json({
              type: 'object',
              properties: {
                data: { type: 'array', items: { $ref: '#/components/schemas/Telemetry' } },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    total: { type: 'integer' },
                    totalPages: { type: 'integer' },
                  },
                },
              },
            }),
          },
          400: errorResponse('Invalid query parameters'),
        },
      },
      post: {
        summary: 'Add a telemetry entry',
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/TelemetryInput' }),
        },
        responses: {
          201: {
            description: 'Created',
            content: json({ $ref: '#/components/schemas/Telemetry' }),
          },
          400: errorResponse('Validation failed'),
        },
      },
    },
    '/telemetry/summary': {
      get: {
        summary: 'Counts per status and the list of known satellite IDs',
        responses: { 200: { description: 'Summary' } },
      },
    },
    '/telemetry/{id}': {
      get: {
        summary: 'Get one telemetry entry',
        parameters: [idParam],
        responses: {
          200: { description: 'Found', content: json({ $ref: '#/components/schemas/Telemetry' }) },
          400: errorResponse('Malformed id'),
          404: errorResponse('Not found'),
        },
      },
      delete: {
        summary: 'Delete a telemetry entry',
        parameters: [idParam],
        responses: {
          204: { description: 'Deleted' },
          400: errorResponse('Malformed id'),
          404: errorResponse('Not found'),
        },
      },
    },
    '/health': {
      get: { summary: 'Liveness check', responses: { 200: { description: 'OK' } } },
    },
  },
  components: {
    schemas: { TelemetryInput: telemetryInput, Telemetry: telemetry, Error: error },
  },
};
