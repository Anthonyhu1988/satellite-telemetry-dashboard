import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { telemetryApi, type TelemetryApi } from '../api/telemetryClient';
import { PAGE_SIZE } from './telemetryReducer';
import { useTelemetry } from './useTelemetry';

function spyApi(): TelemetryApi {
  return {
    list: vi.fn(telemetryApi.list),
    summary: vi.fn(telemetryApi.summary),
    create: vi.fn(telemetryApi.create),
    remove: vi.fn(telemetryApi.remove),
  };
}

async function setup() {
  const api = spyApi();
  const hook = renderHook(() => useTelemetry(api));
  await waitFor(() => expect(hook.result.current.state.loading).toBe(false));
  return { api, ...hook };
}

describe('useTelemetry', () => {
  it('loads the first page and the summary on mount', async () => {
    const { api, result } = await setup();
    expect(api.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: PAGE_SIZE, sortBy: 'timestamp', order: 'desc' }),
    );
    expect(result.current.state.items).toHaveLength(PAGE_SIZE);
    await waitFor(() => expect(result.current.state.summary?.total).toBe(12));
  });

  it('refetches with the new filter', async () => {
    const { api, result } = await setup();
    act(() => result.current.setFilters({ satelliteId: 'SAT-001', status: '' }));
    await waitFor(() =>
      expect(result.current.state.items.every((i) => i.satelliteId === 'SAT-001')).toBe(true),
    );
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ satelliteId: 'SAT-001', page: 1 }),
    );
  });

  it('refetches when the sort changes', async () => {
    const { api, result } = await setup();
    act(() => result.current.toggleSort('altitude'));
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'altitude', order: 'desc' }),
      ),
    );
  });

  it('refetches when the page changes', async () => {
    const { api, result } = await setup();
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.state.items).toHaveLength(2));
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('reloads after creating an entry', async () => {
    const { api, result } = await setup();
    const calls = vi.mocked(api.list).mock.calls.length;
    await act(() =>
      result.current.createEntry({
        satelliteId: 'SAT-NEW',
        timestamp: '2030-01-01T00:00:00Z',
        altitude: 400,
        velocity: 7.7,
        status: 'warning',
      }),
    );
    await waitFor(() => expect(result.current.state.items[0]?.satelliteId).toBe('SAT-NEW'));
    expect(vi.mocked(api.list).mock.calls.length).toBeGreaterThan(calls);
  });

  it('removes an entry and refreshes the total', async () => {
    const { result } = await setup();
    const target = result.current.state.items[0]!;
    await act(() => result.current.removeEntry(target.id));
    await waitFor(() => expect(result.current.state.pagination?.total).toBe(11));
    expect(result.current.state.items.find((i) => i.id === target.id)).toBeUndefined();
  });

  it('exposes the error message when the request fails, and recovers on reload', async () => {
    const api = spyApi();
    vi.mocked(api.list).mockRejectedValueOnce(new Error('backend down'));
    const { result } = renderHook(() => useTelemetry(api));
    await waitFor(() => expect(result.current.state.error).toBe('backend down'));

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.state.error).toBeNull());
    expect(result.current.state.items.length).toBeGreaterThan(0);
  });
});
