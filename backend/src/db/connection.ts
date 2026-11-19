import Database from 'better-sqlite3';

// Timestamps are stored as UTC ISO strings (the service normalizes them), so plain
// string ordering on that column is also chronological ordering.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS telemetry (
    id           TEXT PRIMARY KEY,
    satellite_id TEXT NOT NULL,
    timestamp    TEXT NOT NULL,
    altitude     REAL NOT NULL CHECK (altitude > 0),
    velocity     REAL NOT NULL CHECK (velocity > 0),
    status       TEXT NOT NULL,
    created_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_telemetry_satellite ON telemetry (satellite_id);
  CREATE INDEX IF NOT EXISTS idx_telemetry_status ON telemetry (status);
`;

export type Db = Database.Database;

// The brief asks for an in-memory store. SQLite in :memory: mode gives real SQL for
// filtering/sorting/paging instead of hand-rolled array code, and every new
// connection is a clean database, which keeps tests isolated for free.
export function createDatabase(filename = ':memory:'): Db {
  const db = new Database(filename);
  db.exec(SCHEMA);
  return db;
}
