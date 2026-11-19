import { useEffect, useState } from 'react';
import { STATUSES, type TelemetryStatus } from '@telemetry/shared';
import type { Filters } from '../hooks/telemetryReducer';

interface Props {
  value: Filters;
  satellites: string[];
  onChange: (filters: Filters) => void;
}

export const DEBOUNCE_MS = 300;

export function FilterBar({ value, satellites, onChange }: Props) {
  const [satelliteText, setSatelliteText] = useState(value.satelliteId);

  // wait for the user to stop typing so we don't fire a request per keystroke
  useEffect(() => {
    const trimmed = satelliteText.trim();
    if (trimmed === value.satelliteId) return;
    const timer = setTimeout(() => onChange({ ...value, satelliteId: trimmed }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [satelliteText, value, onChange]);

  const hasFilters = value.satelliteId !== '' || value.status !== '';

  return (
    <div className="filters" role="search">
      <label className="field">
        <span className="field__label">Satellite ID</span>
        <input
          type="search"
          list="filter-satellites"
          placeholder="e.g. SAT-001"
          value={satelliteText}
          onChange={(e) => setSatelliteText(e.target.value)}
        />
        <datalist id="filter-satellites">
          {satellites.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </label>

      <label className="field">
        <span className="field__label">Health status</span>
        <select
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value as TelemetryStatus | '' })}
        >
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status[0]!.toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
      </label>

      {hasFilters && (
        <button
          type="button"
          className="btn btn--ghost filters__clear"
          onClick={() => {
            setSatelliteText('');
            onChange({ satelliteId: '', status: '' });
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
