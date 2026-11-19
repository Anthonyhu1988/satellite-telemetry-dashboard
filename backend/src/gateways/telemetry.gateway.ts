import type { SortField, SortOrder, Telemetry, TelemetryStatus } from '@telemetry/shared';

export interface TelemetryQuery {
  satelliteId?: string;
  status?: TelemetryStatus;
  sortBy: SortField;
  order: SortOrder;
  /** Leave out limit/offset to get every matching row. */
  limit?: number;
  offset?: number;
}

/**
 * Everything the service needs from storage. The service only knows this interface,
 * so moving from SQLite to Postgres means writing one new class, nothing else.
 * Methods are async even though better-sqlite3 is sync, for that same reason.
 */
export interface TelemetryGateway {
  findAll(query: TelemetryQuery): Promise<{ rows: Telemetry[]; total: number }>;
  findById(id: string): Promise<Telemetry | undefined>;
  insert(entry: Telemetry): Promise<Telemetry>;
  delete(id: string): Promise<boolean>;
  countByStatus(): Promise<Record<string, number>>;
  listSatelliteIds(): Promise<string[]>;
}
