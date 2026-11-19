import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../src/errors/AppError';
import { DEFAULT_PAGE_SIZE, TelemetryService } from '../src/services/telemetry.service';
import { FakeGateway, makeEntry, validInput } from './helpers';

let gateway: FakeGateway;
let service: TelemetryService;
const fixedNow = new Date('2026-11-18T12:34:56.000Z');

beforeEach(() => {
  gateway = new FakeGateway();
  service = new TelemetryService(gateway, () => fixedNow);
});

describe('TelemetryService.create', () => {
  it('generates an id and createdAt', async () => {
    const created = await service.create(validInput);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toBe(fixedNow.toISOString());
    expect(gateway.rows).toHaveLength(1);
  });

  it('normalizes the timestamp to UTC', async () => {
    const created = await service.create({ ...validInput, timestamp: '2026-11-18T12:00:00+02:00' });
    expect(created.timestamp).toBe('2026-11-18T10:00:00.000Z');
  });
});

describe('TelemetryService.list', () => {
  beforeEach(() => {
    for (let i = 0; i < 45; i++) gateway.rows.push(makeEntry());
  });

  it('returns every row when page and limit are not given', async () => {
    const result = await service.list();
    expect(result.data).toHaveLength(45);
    expect(result.pagination).toEqual({ page: 1, limit: 45, total: 45, totalPages: 1 });
    expect(gateway.lastQuery?.limit).toBeUndefined();
  });

  it('defaults to newest first', async () => {
    await service.list();
    expect(gateway.lastQuery).toMatchObject({ sortBy: 'timestamp', order: 'desc' });
  });

  it('uses the default page size when only page is given', async () => {
    const result = await service.list({ page: 1 });
    expect(result.data).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(result.pagination.totalPages).toBe(3);
  });

  it('works out the offset and the last partial page', async () => {
    const result = await service.list({ page: 3, limit: 20 });
    expect(gateway.lastQuery).toMatchObject({ limit: 20, offset: 40 });
    expect(result.data).toHaveLength(5);
    expect(result.pagination).toEqual({ page: 3, limit: 20, total: 45, totalPages: 3 });
  });

  it('returns an empty page past the end instead of failing', async () => {
    const result = await service.list({ page: 10, limit: 20 });
    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(45);
  });

  it('reports zero pages for an empty result', async () => {
    gateway.rows = [];
    expect((await service.list()).pagination.totalPages).toBe(0);
    expect((await service.list({ limit: 10 })).pagination.totalPages).toBe(0);
  });

  it('passes filters and sorting through to the gateway', async () => {
    await service.list({
      satelliteId: 'SAT-9',
      status: 'critical',
      sortBy: 'altitude',
      order: 'asc',
    });
    expect(gateway.lastQuery).toMatchObject({
      satelliteId: 'SAT-9',
      status: 'critical',
      sortBy: 'altitude',
      order: 'asc',
    });
  });
});

describe('TelemetryService.getById / remove', () => {
  it('returns an existing entry', async () => {
    const entry = makeEntry();
    gateway.rows.push(entry);
    expect(await service.getById(entry.id)).toEqual(entry);
  });

  it('throws NotFoundError for a missing id', async () => {
    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('removes an existing entry', async () => {
    const entry = makeEntry();
    gateway.rows.push(entry);
    await service.remove(entry.id);
    expect(gateway.rows).toHaveLength(0);
  });

  it('throws NotFoundError when deleting a missing id', async () => {
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('TelemetryService.summary', () => {
  it('counts every status, including ones with zero entries', async () => {
    gateway.rows.push(
      makeEntry({ satelliteId: 'SAT-2', status: 'healthy' }),
      makeEntry({ satelliteId: 'SAT-1', status: 'healthy' }),
      makeEntry({ satelliteId: 'SAT-1', status: 'critical' }),
    );
    expect(await service.summary()).toEqual({
      total: 3,
      byStatus: { healthy: 2, warning: 0, critical: 1 },
      satellites: ['SAT-1', 'SAT-2'],
    });
  });
});
