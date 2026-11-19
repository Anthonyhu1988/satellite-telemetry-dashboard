import { useRef, useState, type FormEvent } from 'react';
import {
  STATUSES,
  telemetryInputSchema,
  type TelemetryInput,
  type TelemetryStatus,
} from '@telemetry/shared';
import { ApiError } from '../api/telemetryClient';

type FieldName = keyof TelemetryInput;
type Errors = Partial<Record<FieldName, string>>;

interface Values {
  satelliteId: string;
  timestamp: string;
  altitude: string;
  velocity: string;
  status: TelemetryStatus;
}

interface Props {
  satellites: string[];
  onSubmit: (input: TelemetryInput) => Promise<unknown>;
  onSuccess?: (input: TelemetryInput) => void;
}

const FIELD_ORDER: FieldName[] = ['satelliteId', 'timestamp', 'altitude', 'velocity', 'status'];

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time, no zone
export function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const emptyValues = (): Values => ({
  satelliteId: '',
  timestamp: toLocalInputValue(new Date()),
  altitude: '',
  velocity: '',
  status: 'healthy',
});

const LABELS: Record<FieldName, string> = {
  satelliteId: 'Satellite ID',
  timestamp: 'Timestamp',
  altitude: 'Altitude',
  velocity: 'Velocity',
  status: 'Status',
};

// schema messages start with the raw field name ("satelliteId is required"); swap in the label
const friendly = (field: string, message: string) =>
  field in LABELS ? message.replace(new RegExp(`^${field}`), LABELS[field as FieldName]) : message;

export function validateForm(values: Values): { input?: TelemetryInput; errors: Errors } {
  const errors: Errors = {};

  if (!values.altitude.trim()) errors.altitude = 'Altitude is required';
  if (!values.velocity.trim()) errors.velocity = 'Velocity is required';

  let timestamp = '';
  if (!values.timestamp) {
    errors.timestamp = 'Timestamp is required';
  } else {
    const date = new Date(values.timestamp);
    if (Number.isNaN(date.getTime())) errors.timestamp = 'Timestamp is not a valid date';
    else timestamp = date.toISOString();
  }

  // the rest of the rules come from the same schema the API uses
  const result = telemetryInputSchema.safeParse({
    satelliteId: values.satelliteId,
    timestamp,
    altitude: Number(values.altitude),
    velocity: Number(values.velocity),
    status: values.status,
  });

  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as FieldName;
      errors[field] ??= friendly(field, issue.message);
    }
  }

  return Object.keys(errors).length || !result.success
    ? { errors }
    : { input: result.data, errors };
}

export function TelemetryForm({ satellites, onSubmit, onSuccess }: Props) {
  const [values, setValues] = useState<Values>(emptyValues);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const update = (field: FieldName) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  const focusFirstError = (errs: Errors) => {
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const { input, errors: clientErrors } = validateForm(values);
    if (!input) {
      setErrors(clientErrors);
      focusFirstError(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(input);
      setValues(emptyValues());
      setErrors({});
      onSuccess?.(input);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        const serverErrors = Object.fromEntries(
          Object.entries(err.fieldErrors).map(([field, msg]) => [field, friendly(field, msg)]),
        ) as Errors;
        setErrors(serverErrors);
        focusFirstError(serverErrors);
      } else {
        setFormError((err as Error).message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const fieldProps = (field: FieldName) => ({
    id: `form-${field}`,
    name: field,
    value: values[field],
    onChange: update(field),
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `form-${field}-error` : undefined,
  });

  const errorFor = (field: FieldName) =>
    errors[field] && (
      <span id={`form-${field}-error`} className="field__error">
        {errors[field]}
      </span>
    );

  return (
    <form
      ref={formRef}
      className="form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Add telemetry"
    >
      <h2 className="panel__title">Add telemetry</h2>

      <div className="field">
        <label className="field__label" htmlFor="form-satelliteId">
          Satellite ID
        </label>
        <input
          {...fieldProps('satelliteId')}
          list="form-satellites"
          placeholder="SAT-001"
          autoComplete="off"
        />
        <datalist id="form-satellites">
          {satellites.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
        {errorFor('satelliteId')}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="form-timestamp">
          Timestamp <span className="field__hint">(your local time)</span>
        </label>
        <input {...fieldProps('timestamp')} type="datetime-local" step="1" />
        {errorFor('timestamp')}
      </div>

      <div className="form__row">
        <div className="field">
          <label className="field__label" htmlFor="form-altitude">
            Altitude (km)
          </label>
          <input
            {...fieldProps('altitude')}
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="550"
          />
          {errorFor('altitude')}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="form-velocity">
            Velocity (km/s)
          </label>
          <input
            {...fieldProps('velocity')}
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="7.6"
          />
          {errorFor('velocity')}
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="form-status">
          Health status
        </label>
        <select {...fieldProps('status')}>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status[0]!.toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
        {errorFor('status')}
      </div>

      {formError && (
        <p className="form__error" role="alert">
          {formError}
        </p>
      )}

      <button type="submit" className="btn btn--primary" disabled={submitting}>
        {submitting ? 'Saving…' : 'Add entry'}
      </button>
    </form>
  );
}
