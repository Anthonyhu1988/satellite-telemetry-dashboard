import { useCallback, useEffect, useReducer } from 'react';
import type { SortField, Telemetry, TelemetryInput } from '@telemetry/shared';
import { telemetryApi, type TelemetryApi } from '../api/telemetryClient';
import { initialState, telemetryReducer, type Filters } from './telemetryReducer';

export function useTelemetry(api: TelemetryApi = telemetryApi) {
  const [state, dispatch] = useReducer(telemetryReducer, initialState);
  const { filters, sort, page, limit, reloadKey } = state;

  useEffect(() => {
    // a flag instead of AbortController: if filters change mid-request we just
    // ignore the stale response, which is all we need here
    let ignore = false;
    dispatch({ type: 'FETCH_START' });

    api
      .list({ ...filters, sortBy: sort.by, order: sort.order, page, limit })
      .then((result) => {
        if (!ignore) dispatch({ type: 'FETCH_SUCCESS', result });
      })
      .catch((err: Error) => {
        if (!ignore) dispatch({ type: 'FETCH_ERROR', error: err.message });
      });

    return () => {
      ignore = true;
    };
  }, [api, filters, sort, page, limit, reloadKey]);

  useEffect(() => {
    let ignore = false;
    api
      .summary()
      .then((summary) => {
        if (!ignore) dispatch({ type: 'SUMMARY_LOADED', summary });
      })
      // the list request surfaces connection problems already; no second banner for this
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [api, reloadKey]);

  const setFilters = useCallback(
    (next: Filters) => dispatch({ type: 'SET_FILTERS', filters: next }),
    [],
  );
  const toggleSort = useCallback(
    (field: SortField) => dispatch({ type: 'TOGGLE_SORT', field }),
    [],
  );
  const setPage = useCallback((next: number) => dispatch({ type: 'SET_PAGE', page: next }), []);
  const reload = useCallback(() => dispatch({ type: 'RELOAD' }), []);

  const createEntry = useCallback(
    async (input: TelemetryInput): Promise<Telemetry> => {
      const created = await api.create(input);
      dispatch({ type: 'RELOAD' });
      return created;
    },
    [api],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      await api.remove(id);
      // drop it from the table right away, then refetch so paging stays right
      dispatch({ type: 'ITEM_DELETED', id });
      dispatch({ type: 'RELOAD' });
    },
    [api],
  );

  return { state, setFilters, toggleSort, setPage, reload, createEntry, removeEntry };
}
