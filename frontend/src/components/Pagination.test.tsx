import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('shows the visible range and disables Previous on page 1', () => {
    render(
      <Pagination
        pagination={{ page: 1, limit: 10, total: 25, totalPages: 3 }}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Showing 1–10 of 25')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('disables Next on the last page and shows a partial range', () => {
    render(
      <Pagination
        pagination={{ page: 3, limit: 10, total: 25, totalPages: 3 }}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Showing 21–25 of 25')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('calls onPageChange with the neighbouring page', async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        pagination={{ page: 2, limit: 10, total: 25, totalPages: 3 }}
        onPageChange={onPageChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPageChange.mock.calls).toEqual([[3], [1]]);
  });

  it('renders nothing when there are no results', () => {
    const { container } = render(
      <Pagination
        pagination={{ page: 1, limit: 10, total: 0, totalPages: 0 }}
        onPageChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
