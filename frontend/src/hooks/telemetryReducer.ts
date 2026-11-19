import type {
  Paginated,
  Pagination,
  SortField,
  SortOrder,
  Telemetry,
  TelemetryStatus,
  TelemetrySummary,
} from '@telemetry/shared';

export interface Filters {
  satelliteId: string;
  status: TelemetryStatus | '';
}

export interface TelemetryState {
  items: Telemetry[];
  pagination: Pagination | null;
  summary: TelemetrySummary | null;
  loading: boolean;
  error: string | null;
  filters: Filters;
  sort: { by: SortField; order: SortOrder };
  page: number;
  limit: number;
  // bumping this re-runs the fetch effect without changing any query params
  reloadKey: number;
}

export type TelemetryAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; result: Paginated<Telemetry> }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'SUMMARY_LOADED'; summary: TelemetrySummary }
  | { type: 'SET_FILTERS'; filters: Filters }
  | { type: 'TOGGLE_SORT'; field: SortField }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'ITEM_DELETED'; id: string }
  | { type: 'RELOAD' };

export const PAGE_SIZE = 10;

export const initialState: TelemetryState = {
  items: [],
  pagination: null,
  summary: null,
  loading: true,
  error: null,
  filters: { satelliteId: '', status: '' },
  sort: { by: 'timestamp', order: 'desc' },
  page: 1,
  limit: PAGE_SIZE,
  reloadKey: 0,
};

export function telemetryReducer(state: TelemetryState, action: TelemetryAction): TelemetryState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };

    case 'FETCH_SUCCESS': {
      const { data, pagination } = action.result;
      // deleting the last row on the last page leaves us past the end, so step back
      if (data.length === 0 && state.page > 1 && pagination.totalPages > 0) {
        return { ...state, page: pagination.totalPages };
      }
      return { ...state, loading: false, error: null, items: data, pagination };
    }

    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };

    case 'SUMMARY_LOADED':
      return { ...state, summary: action.summary };

    case 'SET_FILTERS':
      if (
        action.filters.satelliteId === state.filters.satelliteId &&
        action.filters.status === state.filters.status
      ) {
        return state;
      }
      return { ...state, filters: action.filters, page: 1 };

    case 'TOGGLE_SORT': {
      const sameField = state.sort.by === action.field;
      const order: SortOrder = sameField && state.sort.order === 'desc' ? 'asc' : 'desc';
      return { ...state, sort: { by: action.field, order }, page: 1 };
    }

    case 'SET_PAGE':
      return action.page === state.page ? state : { ...state, page: action.page };

    case 'ITEM_DELETED':
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.id),
        pagination: state.pagination && {
          ...state.pagination,
          total: Math.max(0, state.pagination.total - 1),
        },
      };

    case 'RELOAD':
      return { ...state, reloadKey: state.reloadKey + 1 };
  }
}
