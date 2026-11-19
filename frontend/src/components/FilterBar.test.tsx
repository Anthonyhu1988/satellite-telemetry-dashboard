import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterBar } from './FilterBar';

const empty = { satelliteId: '', status: '' } as const;

describe('FilterBar', () => {
  it('debounces typing and calls onChange once with the trimmed id', async () => {
    const onChange = vi.fn();
    render(<FilterBar value={empty} satellites={[]} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Satellite ID'), ' SAT-002 ');
    expect(onChange).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith({ satelliteId: 'SAT-002', status: '' });
  });

  it('applies the status filter immediately', async () => {
    const onChange = vi.fn();
    render(<FilterBar value={empty} satellites={[]} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Health status'), 'critical');
    expect(onChange).toHaveBeenCalledWith({ satelliteId: '', status: 'critical' });
  });

  it('offers known satellite ids as suggestions', () => {
    const { container } = render(
      <FilterBar value={empty} satellites={['SAT-001', 'SAT-002']} onChange={vi.fn()} />,
    );
    const options = [...container.querySelectorAll('#filter-satellites option')].map((o) =>
      o.getAttribute('value'),
    );
    expect(options).toEqual(['SAT-001', 'SAT-002']);
  });

  it('only shows "Clear filters" when something is filtered, and clears both', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<FilterBar value={empty} satellites={[]} onChange={onChange} />);
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();

    rerender(
      <FilterBar
        value={{ satelliteId: 'SAT-1', status: 'warning' }}
        satellites={[]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(onChange).toHaveBeenCalledWith({ satelliteId: '', status: '' });
  });
});
