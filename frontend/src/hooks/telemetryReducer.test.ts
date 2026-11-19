import { describe, expect, it } from 'vitest';
import type { Telemetry } from '@telemetry/shared';
import { initialState, telemetryReducer, type TelemetryState } from './telemetryReducer';

const entry = (id: string): Telemetry => ({
  id,
  satelliteId: 'SAT-1',
  timestamp: '2026-11-18T10:00:00.000Z',
  altitude: 500,
  velocity: 7.6,
  status: 'healthy',
  createdAt: '2026-11-18T10:00:00.000Z',
});

const loaded: TelemetryState = {
  ...initialState,
  loading: false,
  items: [entry('a'), entry('b')],
  pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
};

describe('telemetryReducer', () => {
  it('FETCH_START sets loading and clears the error', () => {
    const state = telemetryReducer({ ...loaded, error: 'old' }, { type: 'FETCH_START' });
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
    expect(state.items).toHaveLength(2);
  });

  it('FETCH_SUCCESS stores items and pagination', () => {
    const result = {
      data: [entry('x')],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
    const state = telemetryReducer(initialState, { type: 'FETCH_SUCCESS', result });
    expect(state).toMatchObject({
      loading: false,
      items: result.data,
      pagination: result.pagination,
    });
  });

  it('FETCH_SUCCESS with an empty page past the end steps back to the last page', () => {
    const result = { data: [], pagination: { page: 3, limit: 10, total: 20, totalPages: 2 } };
    const state = telemetryReducer({ ...loaded, page: 3 }, { type: 'FETCH_SUCCESS', result });
    expect(state.page).toBe(2);
  });

  it('FETCH_ERROR stores the message and stops loading', () => {
    const state = telemetryReducer(initialState, { type: 'FETCH_ERROR', error: 'down' });
    expect(state).toMatchObject({ loading: false, error: 'down' });
  });

  it('SUMMARY_LOADED stores the summary', () => {
    const summary = {
      total: 1,
      byStatus: { healthy: 1, warning: 0, critical: 0 },
      satellites: ['SAT-1'],
    };
    expect(telemetryReducer(initialState, { type: 'SUMMARY_LOADED', summary }).summary).toBe(
      summary,
    );
  });

  it('SET_FILTERS updates filters and resets to page 1', () => {
    const state = telemetryReducer(
      { ...loaded, page: 3 },
      {
        type: 'SET_FILTERS',
        filters: { satelliteId: 'SAT-2', status: 'critical' },
      },
    );
    expect(state.filters).toEqual({ satelliteId: 'SAT-2', status: 'critical' });
    expect(state.page).toBe(1);
  });

  it('SET_FILTERS with identical values returns the same state (no refetch)', () => {
    const state = telemetryReducer(loaded, {
      type: 'SET_FILTERS',
      filters: { satelliteId: '', status: '' },
    });
    expect(state).toBe(loaded);
  });

  it('TOGGLE_SORT flips the order on the same column', () => {
    const once = telemetryReducer(loaded, { type: 'TOGGLE_SORT', field: 'timestamp' });
    expect(once.sort).toEqual({ by: 'timestamp', order: 'asc' });
    const twice = telemetryReducer(once, { type: 'TOGGLE_SORT', field: 'timestamp' });
    expect(twice.sort).toEqual({ by: 'timestamp', order: 'desc' });
  });

  it('TOGGLE_SORT on a new column starts descending and resets the page', () => {
    const state = telemetryReducer(
      { ...loaded, page: 2 },
      { type: 'TOGGLE_SORT', field: 'altitude' },
    );
    expect(state.sort).toEqual({ by: 'altitude', order: 'desc' });
    expect(state.page).toBe(1);
  });

  it('SET_PAGE changes the page, and is a no-op for the current page', () => {
    expect(telemetryReducer(loaded, { type: 'SET_PAGE', page: 2 }).page).toBe(2);
    expect(telemetryReducer(loaded, { type: 'SET_PAGE', page: 1 })).toBe(loaded);
  });

  it('ITEM_DELETED removes the row and decrements the total', () => {
    const state = telemetryReducer(loaded, { type: 'ITEM_DELETED', id: 'a' });
    expect(state.items.map((i) => i.id)).toEqual(['b']);
    expect(state.pagination?.total).toBe(1);
  });

  it('RELOAD bumps reloadKey', () => {
    expect(telemetryReducer(loaded, { type: 'RELOAD' }).reloadKey).toBe(loaded.reloadKey + 1);
  });
});
