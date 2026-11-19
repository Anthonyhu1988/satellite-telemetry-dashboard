import type { TelemetryStatus } from '@telemetry/shared';

const ICONS: Record<TelemetryStatus, string> = {
  healthy: '●',
  warning: '▲',
  critical: '✕',
};

// color alone isn't enough for colorblind users, so each status also gets a shape
export function StatusBadge({ status }: { status: TelemetryStatus }) {
  return (
    <span className={`badge badge--${status}`}>
      <span aria-hidden="true">{ICONS[status]}</span>
      {status}
    </span>
  );
}
