import {
  STATUSES,
  type Paginated,
  type SortField,
  type Telemetry,
  type TelemetryInput,
  type TelemetryStatus,
  type TelemetrySummary,
} from '@telemetry/shared';

// A tiny in-memory copy of the backend's behaviour, used by the MSW handlers.
// Kept deliberately simple: it's for tests and the offline demo, not a second backend.

let rows: Telemetry[] = [];
let nextId = 1;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function seedRows(): Telemetry[] {
  const sats = ['SAT-001', 'SAT-002', 'SAT-003'];
  const statuses: TelemetryStatus[] = ['healthy', 'healthy', 'warning', 'healthy', 'critical'];
  return Array.from({ length: 12 }, (_, i) => ({
    id: uuid(i + 1),
    satelliteId: sats[i % sats.length]!,
    timestamp: new Date(Date.UTC(2026, 10, 18, 12 - i)).toISOString(),
    altitude: 500 + i * 10,
    velocity: Math.round((7.7 - i * 0.01) * 100) / 100,
    status: statuses[i % statuses.length]!,
    createdAt: '2026-11-18T12:00:00.000Z',
  }));
}

export function resetMockDb(initial: Telemetry[] = seedRows()) {
  rows = initial.map((r) => ({ ...r }));
  nextId = rows.length + 1;
}

resetMockDb();

export interface MockListParams {
  satelliteId?: string | null;
  status?: string | null;
  sortBy?: string | null;
  order?: string | null;
  page?: string | null;
  limit?: string | null;
}

export function listRows(params: MockListParams): Paginated<Telemetry> {
  const sortBy = (params.sortBy ?? 'timestamp') as SortField;
  const dir = params.order === 'asc' ? 1 : -1;

  const matches = rows
    .filter((r) => !params.satelliteId || r.satelliteId === params.satelliteId)
    .filter((r) => !params.status || r.status === params.status.toLowerCase())
    .sort((a, b) => (a[sortBy] < b[sortBy] ? -dir : a[sortBy] > b[sortBy] ? dir : 0));

  const total = matches.length;
  if (!params.page && !params.limit) {
    return {
      data: matches,
      pagination: { page: 1, limit: total, total, totalPages: total ? 1 : 0 },
    };
  }

  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 20);
  return {
    data: matches.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export function insertRow(input: TelemetryInput): Telemetry {
  const row: Telemetry = {
    ...input,
    id: uuid(nextId++),
    timestamp: new Date(input.timestamp).toISOString(),
    createdAt: new Date().toISOString(),
  };
  rows.push(row);
  return row;
}

export function deleteRow(id: string): boolean {
  const before = rows.length;
  rows = rows.filter((r) => r.id !== id);
  return rows.length < before;
}

export function summarize(): TelemetrySummary {
  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]),
  ) as Record<TelemetryStatus, number>;
  return {
    total: rows.length,
    byStatus,
    satellites: [...new Set(rows.map((r) => r.satelliteId))].sort(),
  };
}
