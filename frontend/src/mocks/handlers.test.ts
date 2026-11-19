import { describe, expect, it } from 'vitest';

// These hit the MSW handlers through plain fetch, the same way the app does in mock mode.
const url = (path: string) => `${window.location.origin}/api${path}`;

describe('mock API handlers', () => {
  it('GET /telemetry returns everything by default, newest first', async () => {
    const body = await (await fetch(url('/telemetry'))).json();
    expect(body.data).toHaveLength(12);
    const times = body.data.map((d: { timestamp: string }) => d.timestamp);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('GET /telemetry filters, sorts and paginates like the real API', async () => {
    const res = await fetch(
      url('/telemetry?satelliteId=SAT-001&sortBy=altitude&order=asc&page=1&limit=2'),
    );
    const body = await res.json();
    expect(body.data.map((d: { altitude: number }) => d.altitude)).toEqual([500, 530]);
    expect(body.pagination).toEqual({ page: 1, limit: 2, total: 4, totalPages: 2 });
  });

  it('GET /telemetry filters by status', async () => {
    const body = await (await fetch(url('/telemetry?status=critical'))).json();
    expect(body.data.every((d: { status: string }) => d.status === 'critical')).toBe(true);
  });

  it('POST /telemetry validates and creates', async () => {
    const bad = await fetch(url('/telemetry'), {
      method: 'POST',
      body: JSON.stringify({ altitude: -1 }),
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe('VALIDATION_ERROR');

    const good = await fetch(url('/telemetry'), {
      method: 'POST',
      body: JSON.stringify({
        satelliteId: 'SAT-X',
        timestamp: '2026-11-18T10:00:00Z',
        altitude: 400,
        velocity: 7.7,
        status: 'healthy',
      }),
    });
    expect(good.status).toBe(201);
    expect((await good.json()).satelliteId).toBe('SAT-X');
  });

  it('DELETE /telemetry/:id removes the entry, then 404s', async () => {
    const { data } = await (await fetch(url('/telemetry'))).json();
    const id = data[0].id;
    expect((await fetch(url(`/telemetry/${id}`), { method: 'DELETE' })).status).toBe(204);
    expect((await fetch(url(`/telemetry/${id}`), { method: 'DELETE' })).status).toBe(404);
  });

  it('GET /telemetry/summary counts statuses', async () => {
    const body = await (await fetch(url('/telemetry/summary'))).json();
    expect(body.total).toBe(12);
    expect(body.satellites).toEqual(['SAT-001', 'SAT-002', 'SAT-003']);
    expect(body.byStatus.healthy + body.byStatus.warning + body.byStatus.critical).toBe(12);
  });
});
