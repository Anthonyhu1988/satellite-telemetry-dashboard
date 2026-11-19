import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/telemetryClient';
import { TelemetryForm, toLocalInputValue, validateForm } from './TelemetryForm';

async function fillValid() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Satellite ID'), 'SAT-777');
  // jsdom can't type into datetime-local one key at a time, so set it directly
  fireEvent.change(screen.getByLabelText(/timestamp/i), { target: { value: '2026-11-18T10:30' } });
  await user.type(screen.getByLabelText('Altitude (km)'), '550');
  await user.type(screen.getByLabelText('Velocity (km/s)'), '7.6');
  await user.selectOptions(screen.getByLabelText('Health status'), 'warning');
  return user;
}

describe('validateForm', () => {
  const base = {
    satelliteId: 'SAT-1',
    timestamp: '2026-11-18T10:30',
    altitude: '500',
    velocity: '7.5',
    status: 'healthy' as const,
  };

  it('turns valid form values into an API payload with a UTC timestamp', () => {
    const { input, errors } = validateForm(base);
    expect(errors).toEqual({});
    expect(input).toEqual({
      satelliteId: 'SAT-1',
      timestamp: new Date('2026-11-18T10:30').toISOString(),
      altitude: 500,
      velocity: 7.5,
      status: 'healthy',
    });
  });

  it('reports required fields with friendly messages', () => {
    const { input, errors } = validateForm({
      ...base,
      satelliteId: '',
      timestamp: '',
      altitude: '',
      velocity: ' ',
    });
    expect(input).toBeUndefined();
    expect(errors).toEqual({
      satelliteId: 'Satellite ID is required',
      timestamp: 'Timestamp is required',
      altitude: 'Altitude is required',
      velocity: 'Velocity is required',
    });
  });

  it('rejects negative and zero numbers', () => {
    const { errors } = validateForm({ ...base, altitude: '-5', velocity: '0' });
    expect(errors.altitude).toBe('Altitude must be a positive number');
    expect(errors.velocity).toBe('Velocity must be a positive number');
  });

  it('rejects a timestamp that is not a date', () => {
    expect(validateForm({ ...base, timestamp: 'nonsense' }).errors.timestamp).toBe(
      'Timestamp is not a valid date',
    );
  });
});

describe('toLocalInputValue', () => {
  it('formats a date for datetime-local inputs', () => {
    expect(toLocalInputValue(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });
});

describe('TelemetryForm', () => {
  it('shows inline errors and does not submit invalid input', async () => {
    const onSubmit = vi.fn();
    render(<TelemetryForm satellites={[]} onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Altitude (km)'), '-5');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Satellite ID is required')).toBeInTheDocument();
    expect(screen.getByText('Altitude must be a positive number')).toBeInTheDocument();
    expect(screen.getByLabelText('Altitude (km)')).toHaveAttribute('aria-invalid', 'true');
    // focus jumps to the first broken field
    expect(screen.getByLabelText('Satellite ID')).toHaveFocus();
  });

  it('clears a field error once the user edits that field', async () => {
    render(<TelemetryForm satellites={[]} onSubmit={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(screen.getByText('Satellite ID is required')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Satellite ID'), 'S');
    expect(screen.queryByText('Satellite ID is required')).not.toBeInTheDocument();
  });

  it('submits a valid payload, resets, and reports success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    render(<TelemetryForm satellites={[]} onSubmit={onSubmit} onSuccess={onSuccess} />);
    const user = await fillValid();
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    const expected = {
      satelliteId: 'SAT-777',
      timestamp: new Date('2026-11-18T10:30').toISOString(),
      altitude: 550,
      velocity: 7.6,
      status: 'warning',
    };
    expect(onSubmit).toHaveBeenCalledWith(expected);
    expect(onSuccess).toHaveBeenCalledWith(expected);
    expect(screen.getByLabelText('Satellite ID')).toHaveValue('');
  });

  it('disables the submit button while saving', async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<TelemetryForm satellites={[]} onSubmit={onSubmit} />);
    const user = await fillValid();
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    resolve();
    expect(await screen.findByRole('button', { name: 'Add entry' })).toBeEnabled();
  });

  it('shows server-side field errors next to the field', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', {
        satelliteId: 'satelliteId is taken',
      }),
    );
    render(<TelemetryForm satellites={[]} onSubmit={onSubmit} />);
    const user = await fillValid();
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(await screen.findByText('Satellite ID is taken')).toBeInTheDocument();
  });

  it('shows a general error when the API is unreachable', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Can't reach the telemetry API"));
    render(<TelemetryForm satellites={[]} onSubmit={onSubmit} />);
    const user = await fillValid();
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the telemetry API");
  });
});
