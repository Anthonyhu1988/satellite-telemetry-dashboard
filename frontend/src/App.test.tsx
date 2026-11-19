import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import App from './App';
import { server } from './test/server';

const dataRows = () => screen.getAllByRole('row').slice(1);

async function renderLoaded() {
  render(<App />);
  await waitFor(() => expect(dataRows()).toHaveLength(10));
}

describe('App', () => {
  it('shows a spinner, then the table and summary', async () => {
    render(<App />);
    expect(screen.getByText(/loading telemetry/i)).toBeInTheDocument();
    await waitFor(() => expect(dataRows()).toHaveLength(10));
    expect(screen.getByText('Showing 1–10 of 12')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Summary' })).toHaveTextContent('Entries12'),
    );
  });

  it('filters by status', async () => {
    await renderLoaded();
    await userEvent.selectOptions(
      within(screen.getByRole('search')).getByLabelText('Health status'),
      'critical',
    );
    await waitFor(() => {
      const badges = dataRows().map((r) => r.querySelector('.badge')?.className);
      expect(badges.length).toBeGreaterThan(0);
      expect(new Set(badges)).toEqual(new Set(['badge badge--critical']));
    });
  });

  it('filters by satellite id', async () => {
    await renderLoaded();
    await userEvent.type(
      within(screen.getByRole('search')).getByLabelText('Satellite ID'),
      'SAT-002',
    );
    await waitFor(() => expect(dataRows()).toHaveLength(4));
    for (const row of dataRows()) expect(row).toHaveTextContent('SAT-002');
  });

  it('sorts by altitude when the header is clicked', async () => {
    await renderLoaded();
    await userEvent.click(screen.getByRole('button', { name: /^altitude/i }));
    await waitFor(() => expect(dataRows()[0]).toHaveTextContent('610'));
    await userEvent.click(screen.getByRole('button', { name: /^altitude/i }));
    await waitFor(() => expect(dataRows()[0]).toHaveTextContent('500'));
  });

  it('pages through results', async () => {
    await renderLoaded();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(dataRows()).toHaveLength(2));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('adds an entry through the form', async () => {
    await renderLoaded();
    const user = userEvent.setup();
    const form = screen.getByRole('form', { name: 'Add telemetry' });
    await user.type(within(form).getByLabelText('Satellite ID'), 'SAT-NEW');
    fireEvent.change(within(form).getByLabelText(/timestamp/i), {
      target: { value: '2030-01-01T00:00' },
    });
    await user.type(within(form).getByLabelText('Altitude (km)'), '420');
    await user.type(within(form).getByLabelText('Velocity (km/s)'), '7.66');
    await user.click(within(form).getByRole('button', { name: 'Add entry' }));

    expect(await screen.findByText('Added reading for SAT-NEW')).toBeInTheDocument();
    await waitFor(() => expect(dataRows()[0]).toHaveTextContent('SAT-NEW'));
    expect(screen.getByText('Showing 1–10 of 13')).toBeInTheDocument();
  });

  it('asks for confirmation before deleting', async () => {
    await renderLoaded();
    const firstRow = dataRows()[0]!;
    const satId = within(firstRow).getAllByRole('cell')[0]!.textContent!;

    await userEvent.click(within(firstRow).getByRole('button', { name: /delete/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1–10 of 12')).toBeInTheDocument();

    await userEvent.click(within(dataRows()[0]!).getByRole('button', { name: /delete/i }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(await screen.findByText(`Deleted ${satId} reading`)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Showing 1–10 of 11')).toBeInTheDocument());
  });

  it('shows a toast if the delete fails', async () => {
    await renderLoaded();
    server.use(http.delete('*/api/telemetry/:id', () => HttpResponse.error()));
    await userEvent.click(within(dataRows()[0]!).getByRole('button', { name: /delete/i }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(await screen.findByText(/couldn't delete/i)).toBeInTheDocument();
  });

  it('shows an error with Retry when the backend is unreachable, and recovers', async () => {
    server.use(http.get('*/api/telemetry', () => HttpResponse.error(), { once: true }));
    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/can't reach the telemetry api/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(dataRows()).toHaveLength(10));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
