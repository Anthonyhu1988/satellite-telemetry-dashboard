import { http, HttpResponse } from 'msw';
import { telemetryInputSchema } from '@telemetry/shared';
import { deleteRow, insertRow, listRows, summarize } from './mockDb';

// "*/api/..." matches whatever origin the app runs on (vite dev, jsdom in tests, etc.)
export const handlers = [
  http.get('*/api/telemetry', ({ request }) => {
    const q = new URL(request.url).searchParams;
    return HttpResponse.json(
      listRows({
        satelliteId: q.get('satelliteId'),
        status: q.get('status'),
        sortBy: q.get('sortBy'),
        order: q.get('order'),
        page: q.get('page'),
        limit: q.get('limit'),
      }),
    );
  }),

  http.get('*/api/telemetry/summary', () => HttpResponse.json(summarize())),

  http.post('*/api/telemetry', async ({ request }) => {
    const result = telemetryInputSchema.safeParse(await request.json());
    if (!result.success) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: result.error.issues.map((i) => ({
              field: i.path.join('.'),
              message: i.message,
            })),
          },
        },
        { status: 400 },
      );
    }
    return HttpResponse.json(insertRow(result.data), { status: 201 });
  }),

  http.delete('*/api/telemetry/:id', ({ params }) => {
    if (!deleteRow(String(params.id))) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: `Telemetry entry ${params.id} not found` } },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
