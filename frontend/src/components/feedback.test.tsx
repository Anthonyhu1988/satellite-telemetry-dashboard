import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorBanner } from './ErrorBanner';
import { Spinner } from './Spinner';
import { SummaryCards } from './SummaryCards';
import { Toast } from './Toast';

describe('Spinner', () => {
  it('announces loading to screen readers', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading telemetry');
  });
});

describe('ErrorBanner', () => {
  it('shows the message as an alert with a Retry button', async () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="Backend unreachable" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('hides Retry when there is nothing to retry', () => {
    render(<ErrorBanner message="Nope" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  const props = { title: 'Delete?', message: 'Sure?', onConfirm: vi.fn(), onCancel: vi.fn() };

  it('focuses Cancel by default', () => {
    render(<ConfirmDialog {...props} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('confirms and cancels', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...props} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...props} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables the confirm button while busy', () => {
    render(<ConfirmDialog {...props} busy />);
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
  });
});

describe('SummaryCards', () => {
  it('shows counts from the summary', () => {
    render(
      <SummaryCards
        summary={{
          total: 30,
          byStatus: { healthy: 21, warning: 6, critical: 3 },
          satellites: ['A', 'B', 'C', 'D', 'E'],
        }}
      />,
    );
    const text = screen.getByRole('region', { name: 'Summary' }).textContent;
    expect(text).toContain('Entries30');
    expect(text).toContain('Satellites5');
    expect(text).toContain('Healthy21');
    expect(text).toContain('Warning6');
    expect(text).toContain('Critical3');
  });

  it('shows placeholders before the summary loads', () => {
    render(<SummaryCards summary={null} />);
    expect(screen.getAllByText('–')).toHaveLength(5);
  });
});

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the message and dismisses itself after the timeout', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toast
        toast={{ id: 1, text: 'Saved', tone: 'success' }}
        onDismiss={onDismiss}
        duration={1000}
      />,
    );
    expect(screen.getByText('Saved')).toHaveClass('toast--success');
    act(() => vi.advanceTimersByTime(1000));
    expect(onDismiss).toHaveBeenCalled();
  });
});
