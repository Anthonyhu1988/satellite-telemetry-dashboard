import type { SortField, Telemetry, TelemetryStatus } from '@telemetry/shared';
import type { TelemetryGateway, TelemetryQuery } from '../gateways/telemetry.gateway';
import type { Db } from './connection';

interface Row {
  id: string;
  satellite_id: string;
  timestamp: string;
  altitude: number;
  velocity: number;
  status: string;
  created_at: string;
}

// Column names can't be bound as SQL parameters, so sorting goes through this
// whitelist instead of string-building from user input.
const SORT_COLUMNS: Record<SortField, string> = {
  timestamp: 'timestamp',
  altitude: 'altitude',
  velocity: 'velocity',
  satelliteId: 'satellite_id',
  status: 'status',
};

const toTelemetry = (row: Row): Telemetry => ({
  id: row.id,
  satelliteId: row.satellite_id,
  timestamp: row.timestamp,
  altitude: row.altitude,
  velocity: row.velocity,
  status: row.status as TelemetryStatus,
  createdAt: row.created_at,
});

export class SqliteTelemetryGateway implements TelemetryGateway {
  constructor(private readonly db: Db) {}

  async findAll(query: TelemetryQuery) {
    const where: string[] = [];
    const params: Record<string, string | number> = {};

    if (query.satelliteId) {
      where.push('satellite_id = @satelliteId');
      params.satelliteId = query.satelliteId;
    }
    if (query.status) {
      where.push('status = @status');
      params.status = query.status;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const direction = query.order === 'asc' ? 'ASC' : 'DESC';
    // id as a tie-breaker keeps page boundaries stable when sort values repeat
    let sql = `SELECT * FROM telemetry ${whereSql} ORDER BY ${SORT_COLUMNS[query.sortBy]} ${direction}, id ${direction}`;

    if (query.limit !== undefined) {
      sql += ' LIMIT @limit OFFSET @offset';
      params.limit = query.limit;
      params.offset = query.offset ?? 0;
    }

    const rows = this.db.prepare(sql).all(params) as Row[];
    const { total } = this.db
      .prepare(`SELECT COUNT(*) AS total FROM telemetry ${whereSql}`)
      .get(params) as { total: number };

    return { rows: rows.map(toTelemetry), total };
  }

  async findById(id: string) {
    const row = this.db.prepare('SELECT * FROM telemetry WHERE id = ?').get(id) as Row | undefined;
    return row ? toTelemetry(row) : undefined;
  }

  async insert(entry: Telemetry) {
    this.db
      .prepare(
        `INSERT INTO telemetry (id, satellite_id, timestamp, altitude, velocity, status, created_at)
         VALUES (@id, @satelliteId, @timestamp, @altitude, @velocity, @status, @createdAt)`,
      )
      .run(entry);
    return entry;
  }

  async delete(id: string) {
    return this.db.prepare('DELETE FROM telemetry WHERE id = ?').run(id).changes > 0;
  }

  async countByStatus() {
    const rows = this.db
      .prepare('SELECT status, COUNT(*) AS count FROM telemetry GROUP BY status')
      .all() as { status: string; count: number }[];
    return Object.fromEntries(rows.map((r) => [r.status, r.count]));
  }

  async listSatelliteIds() {
    const rows = this.db
      .prepare('SELECT DISTINCT satellite_id FROM telemetry ORDER BY satellite_id')
      .all() as { satellite_id: string }[];
    return rows.map((r) => r.satellite_id);
  }
}
