import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { validInput } from './helpers';

let app: Express;

beforeEach(async () => {
  app = await createApp();
});

async function create(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/telemetry')
    .send({ ...validInput, ...overrides });
  expect(res.status).toBe(201);
  return res.body;
}

describe('GET /health', () => {
  it('reports ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /telemetry', () => {
  it('creates an entry and returns it with an id', async () => {
    const res = await request(app).post('/telemetry').send(validInput);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(validInput);
    expect(res.body.id).toBeDefined();
    expect(res.headers.location).toBe(`/telemetry/${res.body.id}`);
  });

  it.each([
    ['a bad timestamp', { timestamp: 'yesterday' }, 'timestamp'],
    ['a timestamp without timezone', { timestamp: '2026-11-18T10:00:00' }, 'timestamp'],
    ['negative altitude', { altitude: -5 }, 'altitude'],
    ['zero velocity', { velocity: 0 }, 'velocity'],
    ['altitude sent as a string', { altitude: '550' }, 'altitude'],
    ['an unknown status', { status: 'exploded' }, 'status'],
    ['an empty satelliteId', { satelliteId: '' }, 'satelliteId'],
  ])('returns 400 for %s', async (_label, overrides, field) => {
    const res = await request(app)
      .post('/telemetry')
      .send({ ...validInput, ...overrides });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
  });

  it('lists every missing field at once', async () => {
    const res = await request(app).post('/telemetry').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveLength(5);
  });

  it('does not store anything when validation fails', async () => {
    await request(app)
      .post('/telemetry')
      .send({ ...validInput, altitude: -1 });
    const res = await request(app).get('/telemetry');
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /telemetry', () => {
  beforeEach(async () => {
    await create({
      satelliteId: 'SAT-1',
      status: 'healthy',
      altitude: 400,
      timestamp: '2026-01-01T00:00:00Z',
    });
    await create({
      satelliteId: 'SAT-1',
      status: 'critical',
      altitude: 500,
      timestamp: '2026-01-02T00:00:00Z',
    });
    await create({
      satelliteId: 'SAT-2',
      status: 'healthy',
      altitude: 600,
      timestamp: '2026-01-03T00:00:00Z',
    });
  });

  it('returns all entries, newest first, when no params are given', async () => {
    const res = await request(app).get('/telemetry');
    expect(res.status).toBe(200);
    expect(res.body.data.map((d: { altitude: number }) => d.altitude)).toEqual([600, 500, 400]);
    expect(res.body.pagination).toEqual({ page: 1, limit: 3, total: 3, totalPages: 1 });
  });

  it('filters by satelliteId', async () => {
    const res = await request(app).get('/telemetry?satelliteId=SAT-1');
    expect(res.body.data).toHaveLength(2);
  });

  it('filters by status, case-insensitively', async () => {
    const res = await request(app).get('/telemetry?status=CRITICAL');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].altitude).toBe(500);
  });

  it('combines filters', async () => {
    const res = await request(app).get('/telemetry?satelliteId=SAT-1&status=healthy');
    expect(res.body.data).toHaveLength(1);
  });

  it('paginates', async () => {
    const res = await request(app).get('/telemetry?page=2&limit=2');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('sorts by altitude ascending', async () => {
    const res = await request(app).get('/telemetry?sortBy=altitude&order=asc');
    expect(res.body.data.map((d: { altitude: number }) => d.altitude)).toEqual([400, 500, 600]);
  });

  it.each([
    ['status=unknown', 'status'],
    ['page=0', 'page'],
    ['limit=500', 'limit'],
    ['page=abc', 'page'],
    ['sortBy=password', 'sortBy'],
    ['order=sideways', 'order'],
  ])('returns 400 for %s', async (query, field) => {
    const res = await request(app).get(`/telemetry?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe(field);
  });
});

describe('GET /telemetry/summary', () => {
  it('returns counts and satellite ids', async () => {
    await create({ satelliteId: 'SAT-1' });
    await create({ satelliteId: 'SAT-2', status: 'warning' });
    const res = await request(app).get('/telemetry/summary');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 2,
      byStatus: { healthy: 1, warning: 1, critical: 0 },
      satellites: ['SAT-1', 'SAT-2'],
    });
  });
});

describe('GET /telemetry/:id', () => {
  it('returns the entry', async () => {
    const created = await create();
    const res = await request(app).get(`/telemetry/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
  });

  it("returns 404 when the id doesn't exist", async () => {
    const res = await request(app).get('/telemetry/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/telemetry/123');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /telemetry/:id', () => {
  it('deletes the entry, then GET returns 404', async () => {
    const created = await create();
    const del = await request(app).delete(`/telemetry/${created.id}`);
    expect(del.status).toBe(204);
    expect(del.text).toBe('');

    const get = await request(app).get(`/telemetry/${created.id}`);
    expect(get.status).toBe(404);
  });

  it("returns 404 when the id doesn't exist", async () => {
    const res = await request(app).delete('/telemetry/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('createApp options', () => {
  it('seeds demo data when asked to', async () => {
    const seeded = await createApp({ seed: true });
    const res = await request(seeded).get('/telemetry?limit=1');
    expect(res.body.pagination.total).toBe(30);
  });

  it('sends CORS headers so the dashboard can call it from another origin', async () => {
    const res = await request(app).get('/telemetry').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});

describe('API docs', () => {
  it('serves an OpenAPI spec covering every endpoint', async () => {
    const res = await request(app).get('/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(['/telemetry', '/telemetry/{id}']),
    );
    expect(Object.keys(res.body.paths['/telemetry'])).toEqual(['get', 'post']);
    expect(Object.keys(res.body.paths['/telemetry/{id}'])).toEqual(['get', 'delete']);
  });

  it('serves the Swagger UI', async () => {
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });
});
