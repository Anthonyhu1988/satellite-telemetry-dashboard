import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test/server';
import { ApiError, buildUrl, NetworkError, telemetryApi } from './telemetryClient';

const valid = {
  satelliteId: 'SAT-9',
  timestamp: '2026-11-18T10:00:00.000Z',
  altitude: 550,
  velocity: 7.6,
  status: 'healthy' as const,
};

describe('buildUrl', () => {
  it('adds only the params that have a value', () => {
    const url = new URL(
      buildUrl('/telemetry', { satelliteId: 'SAT-1', status: '', page: 2, limit: undefined }),
    );
    expect(url.pathname).toBe('/api/telemetry');
    expect(Object.fromEntries(url.searchParams)).toEqual({ satelliteId: 'SAT-1', page: '2' });
  });
});

describe('telemetryApi', () => {
  it('lists telemetry and parses the envelope', async () => {
    const result = await telemetryApi.list({ page: 1, limit: 5 });
    expect(result.data).toHaveLength(5);
    expect(result.pagination).toMatchObject({ page: 1, limit: 5, total: 12 });
  });

  it('sends filters and sorting as query params', async () => {
    let seen: URLSearchParams | undefined;
    server.use(
      http.get('*/api/telemetry', ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        });
      }),
    );
    await telemetryApi.list({
      satelliteId: 'SAT-2',
      status: 'critical',
      sortBy: 'altitude',
      order: 'asc',
      page: 3,
      limit: 10,
    });
    expect(Object.fromEntries(seen!)).toEqual({
      satelliteId: 'SAT-2',
      status: 'critical',
      sortBy: 'altitude',
      order: 'asc',
      page: '3',
      limit: '10',
    });
  });

  it('creates an entry', async () => {
    const created = await telemetryApi.create(valid);
    expect(created).toMatchObject(valid);
    expect(created.id).toBeDefined();
  });

  it('deletes an entry', async () => {
    const { data } = await telemetryApi.list();
    await expect(telemetryApi.remove(data[0]!.id)).resolves.toBeUndefined();
  });

  it('turns a 400 into an ApiError with field errors', async () => {
    const err = await telemetryApi.create({ ...valid, altitude: -5 }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.fieldErrors).toEqual({ altitude: 'altitude must be a positive number' });
  });

  it('turns a 404 into an ApiError', async () => {
    const err = await telemetryApi.remove('nope').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('throws NetworkError when the server is unreachable', async () => {
    server.use(http.get('*/api/telemetry', () => HttpResponse.error()));
    await expect(telemetryApi.list()).rejects.toBeInstanceOf(NetworkError);
  });

  it('treats a proxy 502 (no JSON body) as unreachable', async () => {
    server.use(http.get('*/api/telemetry', () => new HttpResponse('Bad Gateway', { status: 502 })));
    await expect(telemetryApi.list()).rejects.toBeInstanceOf(NetworkError);
  });

  it('keeps the API message for a real 500 from the backend', async () => {
    server.use(
      http.get('*/api/telemetry', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
          { status: 500 },
        ),
      ),
    );
    const err = await telemetryApi.list().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Something went wrong');
  });

  it('falls back to a generic message when an error has no body', async () => {
    server.use(http.get('*/api/telemetry', () => new HttpResponse(null, { status: 418 })));
    const err = await telemetryApi.list().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Request failed with status 418');
  });
});
