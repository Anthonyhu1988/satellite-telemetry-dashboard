import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Telemetry } from '@telemetry/shared';
import { TelemetryTable } from './TelemetryTable';

const items: Telemetry[] = [
  {
    id: '1',
    satelliteId: 'SAT-001',
    timestamp: '2026-11-18T10:00:00.000Z',
    altitude: 550.5,
    velocity: 7.59,
    status: 'healthy',
    createdAt: '',
  },
  {
    id: '2',
    satelliteId: 'SAT-002',
    timestamp: '2026-11-18T09:00:00.000Z',
    altitude: 420,
    velocity: 7.66,
    status: 'critical',
    createdAt: '',
  },
];

const defaultSort = { by: 'timestamp', order: 'desc' } as const;

function renderTable(props: Partial<Parameters<typeof TelemetryTable>[0]> = {}) {
  const onSort = vi.fn();
  const onDelete = vi.fn();
  render(
    <TelemetryTable
      items={items}
      sort={defaultSort}
      onSort={onSort}
      onDelete={onDelete}
      {...props}
    />,
  );
  return { onSort, onDelete };
}

describe('TelemetryTable', () => {
  it('renders the five required columns', () => {
    renderTable();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers.slice(0, 5)).toEqual([
      expect.stringContaining('Satellite ID'),
      expect.stringContaining('Timestamp'),
      expect.stringContaining('Altitude'),
      expect.stringContaining('Velocity'),
      expect.stringContaining('Health Status'),
    ]);
  });

  it('renders one row per entry with its values', () => {
    renderTable();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const first = within(rows[0]!);
    expect(first.getByText('SAT-001')).toBeInTheDocument();
    expect(first.getByText('550.5')).toBeInTheDocument();
    expect(first.getByText('7.59')).toBeInTheDocument();
    expect(first.getByText('healthy')).toBeInTheDocument();
    expect(rows[0]!.querySelector('time')).toHaveAttribute('dateTime', '2026-11-18T10:00:00.000Z');
  });

  it('gives each status badge its own class', () => {
    renderTable();
    expect(screen.getByText('healthy').closest('.badge')).toHaveClass('badge--healthy');
    expect(screen.getByText('critical').closest('.badge')).toHaveClass('badge--critical');
  });

  it('shows an empty state when there is nothing to show', () => {
    renderTable({ items: [] });
    expect(screen.getByText(/no telemetry matches/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('marks the active sort column with aria-sort', () => {
    renderTable({ sort: { by: 'altitude', order: 'asc' } });
    expect(screen.getByRole('columnheader', { name: /altitude/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.getByRole('columnheader', { name: /timestamp/i })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it.each([
    ['Timestamp', 'timestamp'],
    ['Altitude (km)', 'altitude'],
    ['Velocity (km/s)', 'velocity'],
  ])('clicking the %s header asks to sort by %s', async (label, field) => {
    const { onSort } = renderTable();
    await userEvent.click(
      screen.getByRole('button', { name: new RegExp(`^${label.replace(/[()/]/g, '\\$&')}`) }),
    );
    expect(onSort).toHaveBeenCalledWith(field);
  });

  it('mobile sort controls pick a field and flip the order', async () => {
    const { onSort } = renderTable();
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'velocity');
    expect(onSort).toHaveBeenCalledWith('velocity');
    await userEvent.click(screen.getByRole('button', { name: /descending/i }));
    expect(onSort).toHaveBeenLastCalledWith('timestamp');
  });

  it('calls onDelete with the row entry', async () => {
    const { onDelete } = renderTable();
    await userEvent.click(screen.getByRole('button', { name: /delete sat-002/i }));
    expect(onDelete).toHaveBeenCalledWith(items[1]);
  });
});
