import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/db/connection';
import { buildSeedData, seed } from '../src/db/seed';
import { SqliteTelemetryGateway } from '../src/db/sqlite-telemetry.gateway';
import { STATUSES, telemetryInputSchema } from '@telemetry/shared';

describe('createDatabase', () => {
  it('creates the telemetry table', () => {
    const db = createDatabase();
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'telemetry'")
      .get();
    expect(table).toEqual({ name: 'telemetry' });
  });

  it('gives every connection its own isolated database', async () => {
    const a = new SqliteTelemetryGateway(createDatabase());
    const b = new SqliteTelemetryGateway(createDatabase());
    await seed(a, 5);
    expect((await a.findAll({ sortBy: 'timestamp', order: 'desc' })).total).toBe(5);
    expect((await b.findAll({ sortBy: 'timestamp', order: 'desc' })).total).toBe(0);
  });

  it('rejects non-positive altitude at the database level too', () => {
    const db = createDatabase();
    const insert = () =>
      db
        .prepare(
          "INSERT INTO telemetry VALUES ('x', 'SAT', '2026-01-01T00:00:00Z', -1, 7, 'healthy', '2026-01-01T00:00:00Z')",
        )
        .run();
    expect(insert).toThrow(/CHECK constraint/);
  });
});

describe('seed data', () => {
  it('inserts the requested number of rows', async () => {
    const gateway = new SqliteTelemetryGateway(createDatabase());
    await seed(gateway);
    expect((await gateway.findAll({ sortBy: 'timestamp', order: 'desc' })).total).toBe(30);
  });

  it('only produces entries that pass the API validation', () => {
    for (const entry of buildSeedData()) {
      const { id: _id, createdAt: _createdAt, ...input } = entry;
      expect(telemetryInputSchema.safeParse(input).success).toBe(true);
    }
  });

  it('is deterministic and covers several satellites and statuses', () => {
    const now = new Date('2026-11-18T00:00:00Z');
    const first = buildSeedData(30, now).map(({ id: _id, ...rest }) => rest);
    const second = buildSeedData(30, now).map(({ id: _id, ...rest }) => rest);
    expect(first).toEqual(second);
    expect(new Set(first.map((e) => e.satelliteId)).size).toBe(5);
    const statuses = new Set(first.map((e) => e.status));
    expect(statuses.size).toBeGreaterThan(1);
    for (const status of statuses) expect(STATUSES).toContain(status);
  });
});
