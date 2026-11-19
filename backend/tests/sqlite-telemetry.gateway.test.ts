import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../src/db/connection';
import { SqliteTelemetryGateway } from '../src/db/sqlite-telemetry.gateway';
import { makeEntry } from './helpers';

let gateway: SqliteTelemetryGateway;

const base = { sortBy: 'timestamp', order: 'asc' } as const;

beforeEach(async () => {
  gateway = new SqliteTelemetryGateway(createDatabase());
  const entries = [
    makeEntry({
      satelliteId: 'SAT-A',
      status: 'healthy',
      altitude: 500,
      velocity: 7.6,
      timestamp: '2026-01-01T00:00:00.000Z',
    }),
    makeEntry({
      satelliteId: 'SAT-A',
      status: 'critical',
      altitude: 300,
      velocity: 7.9,
      timestamp: '2026-01-02T00:00:00.000Z',
    }),
    makeEntry({
      satelliteId: 'SAT-B',
      status: 'healthy',
      altitude: 800,
      velocity: 7.4,
      timestamp: '2026-01-03T00:00:00.000Z',
    }),
    makeEntry({
      satelliteId: 'SAT-B',
      status: 'warning',
      altitude: 650,
      velocity: 7.5,
      timestamp: '2026-01-04T00:00:00.000Z',
    }),
    makeEntry({
      satelliteId: 'SAT-C',
      status: 'critical',
      altitude: 1200,
      velocity: 7.2,
      timestamp: '2026-01-05T00:00:00.000Z',
    }),
  ];
  for (const e of entries) await gateway.insert(e);
});

describe('SqliteTelemetryGateway', () => {
  it('inserts and finds an entry by id', async () => {
    const entry = makeEntry({ satelliteId: 'SAT-Z' });
    await gateway.insert(entry);
    expect(await gateway.findById(entry.id)).toEqual(entry);
  });

  it('returns undefined for an unknown id', async () => {
    expect(await gateway.findById('nope')).toBeUndefined();
  });

  it('deletes an entry and reports whether anything was removed', async () => {
    const entry = makeEntry();
    await gateway.insert(entry);
    expect(await gateway.delete(entry.id)).toBe(true);
    expect(await gateway.findById(entry.id)).toBeUndefined();
    expect(await gateway.delete(entry.id)).toBe(false);
  });

  it('returns everything when there are no filters', async () => {
    const { rows, total } = await gateway.findAll(base);
    expect(total).toBe(5);
    expect(rows).toHaveLength(5);
  });

  it('filters by satelliteId', async () => {
    const { rows, total } = await gateway.findAll({ ...base, satelliteId: 'SAT-A' });
    expect(total).toBe(2);
    expect(rows.every((r) => r.satelliteId === 'SAT-A')).toBe(true);
  });

  it('filters by status', async () => {
    const { rows } = await gateway.findAll({ ...base, status: 'critical' });
    expect(rows.map((r) => r.satelliteId)).toEqual(['SAT-A', 'SAT-C']);
  });

  it('combines filters', async () => {
    const { rows, total } = await gateway.findAll({
      ...base,
      satelliteId: 'SAT-B',
      status: 'warning',
    });
    expect(total).toBe(1);
    expect(rows[0]?.altitude).toBe(650);
  });

  it.each([
    ['timestamp', 'asc', [500, 300, 800, 650, 1200]],
    ['timestamp', 'desc', [1200, 650, 800, 300, 500]],
    ['altitude', 'asc', [300, 500, 650, 800, 1200]],
    ['altitude', 'desc', [1200, 800, 650, 500, 300]],
    ['velocity', 'asc', [1200, 800, 650, 500, 300]],
    ['velocity', 'desc', [300, 500, 650, 800, 1200]],
  ] as const)('sorts by %s %s', async (sortBy, order, expectedAltitudes) => {
    const { rows } = await gateway.findAll({ sortBy, order });
    expect(rows.map((r) => r.altitude)).toEqual(expectedAltitudes);
  });

  it('applies limit and offset but still reports the full total', async () => {
    const { rows, total } = await gateway.findAll({ ...base, limit: 2, offset: 2 });
    expect(total).toBe(5);
    expect(rows.map((r) => r.altitude)).toEqual([800, 650]);
  });

  it('counts entries per status', async () => {
    expect(await gateway.countByStatus()).toEqual({ healthy: 2, critical: 2, warning: 1 });
  });

  it('lists distinct satellite ids in order', async () => {
    expect(await gateway.listSatelliteIds()).toEqual(['SAT-A', 'SAT-B', 'SAT-C']);
  });
});
