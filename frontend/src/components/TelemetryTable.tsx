import type { SortField, SortOrder, Telemetry } from '@telemetry/shared';
import { StatusBadge } from './StatusBadge';

interface Props {
  items: Telemetry[];
  sort: { by: SortField; order: SortOrder };
  onSort: (field: SortField) => void;
  onDelete: (entry: Telemetry) => void;
}

const COLUMNS: { field: SortField; label: string; numeric?: boolean }[] = [
  { field: 'satelliteId', label: 'Satellite ID' },
  { field: 'timestamp', label: 'Timestamp' },
  { field: 'altitude', label: 'Altitude (km)', numeric: true },
  { field: 'velocity', label: 'Velocity (km/s)', numeric: true },
  { field: 'status', label: 'Health Status' },
];

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

export function TelemetryTable({ items, sort, onSort, onDelete }: Props) {
  if (items.length === 0) {
    return <p className="empty">No telemetry matches these filters.</p>;
  }

  return (
    <div className="table-wrap">
      {/* the header row is hidden on phones, so they get a plain select instead */}
      <div className="mobile-sort">
        <label className="field">
          <span className="field__label">Sort by</span>
          <select value={sort.by} onChange={(e) => onSort(e.target.value as SortField)}>
            {COLUMNS.map((col) => (
              <option key={col.field} value={col.field}>
                {col.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--ghost" onClick={() => onSort(sort.by)}>
          {sort.order === 'asc' ? '▲ Ascending' : '▼ Descending'}
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const active = sort.by === col.field;
              return (
                <th
                  key={col.field}
                  scope="col"
                  className={col.numeric ? 'num' : undefined}
                  aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button type="button" className="sort-btn" onClick={() => onSort(col.field)}>
                    {col.label}
                    <span
                      className={`sort-btn__arrow${active ? ' is-active' : ''}`}
                      aria-hidden="true"
                    >
                      {active && sort.order === 'asc' ? '▲' : '▼'}
                    </span>
                  </button>
                </th>
              );
            })}
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => (
            <tr key={entry.id}>
              <td data-label="Satellite ID" className="mono">
                {entry.satelliteId}
              </td>
              <td data-label="Timestamp">
                <time dateTime={entry.timestamp} title={entry.timestamp}>
                  {dateFormat.format(new Date(entry.timestamp))}
                </time>
              </td>
              <td data-label="Altitude (km)" className="num">
                {numberFormat.format(entry.altitude)}
              </td>
              <td data-label="Velocity (km/s)" className="num">
                {numberFormat.format(entry.velocity)}
              </td>
              <td data-label="Health Status">
                <StatusBadge status={entry.status} />
              </td>
              <td className="actions">
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => onDelete(entry)}
                  aria-label={`Delete ${entry.satelliteId} reading from ${entry.timestamp}`}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
