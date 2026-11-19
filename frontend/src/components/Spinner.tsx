export function Spinner({ label = 'Loading telemetry' }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__ring" aria-hidden="true" />
      <span className="spinner__label">{label}…</span>
    </div>
  );
}
