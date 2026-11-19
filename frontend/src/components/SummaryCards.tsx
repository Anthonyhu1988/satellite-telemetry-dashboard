import type { TelemetrySummary } from '@telemetry/shared';

export function SummaryCards({ summary }: { summary: TelemetrySummary | null }) {
  const cards = [
    { label: 'Entries', value: summary?.total, tone: 'neutral' },
    { label: 'Satellites', value: summary?.satellites.length, tone: 'neutral' },
    { label: 'Healthy', value: summary?.byStatus.healthy, tone: 'healthy' },
    { label: 'Warning', value: summary?.byStatus.warning, tone: 'warning' },
    { label: 'Critical', value: summary?.byStatus.critical, tone: 'critical' },
  ];

  return (
    <section className="summary" aria-label="Summary">
      {cards.map((card) => (
        <div key={card.label} className={`summary__card summary__card--${card.tone}`}>
          <span className="summary__label">{card.label}</span>
          <span className="summary__value">{card.value ?? '–'}</span>
        </div>
      ))}
    </section>
  );
}
