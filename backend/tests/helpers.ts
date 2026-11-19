import { randomUUID } from 'node:crypto';
import type { Telemetry, TelemetryInput } from '@telemetry/shared';
import type { TelemetryGateway, TelemetryQuery } from '../src/gateways/telemetry.gateway';

export const validInput: TelemetryInput = {
  satelliteId: 'SAT-001',
  timestamp: '2026-11-18T10:00:00.000Z',
  altitude: 550,
  velocity: 7.59,
  status: 'healthy',
};

export function makeEntry(overrides: Partial<Telemetry> = {}): Telemetry {
  return {
    ...validInput,
    id: randomUUID(),
    createdAt: '2026-11-18T12:00:00.000Z',
    ...overrides,
  };
}

// Array-backed gateway so service tests don't touch SQLite at all.
export class FakeGateway implements TelemetryGateway {
  rows: Telemetry[] = [];
  lastQuery?: TelemetryQuery;

  async findAll(query: TelemetryQuery) {
    this.lastQuery = query;
    const matches = this.rows.filter(
      (r) =>
        (!query.satelliteId || r.satelliteId === query.satelliteId) &&
        (!query.status || r.status === query.status),
    );
    const sliced =
      query.limit === undefined
        ? matches
        : matches.slice(query.offset ?? 0, (query.offset ?? 0) + query.limit);
    return { rows: sliced, total: matches.length };
  }
  async findById(id: string) {
    return this.rows.find((r) => r.id === id);
  }
  async insert(entry: Telemetry) {
    this.rows.push(entry);
    return entry;
  }
  async delete(id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.id !== id);
    return this.rows.length < before;
  }
  async countByStatus() {
    const counts: Record<string, number> = {};
    for (const r of this.rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }
  async listSatelliteIds() {
    return [...new Set(this.rows.map((r) => r.satelliteId))].sort();
  }
}
