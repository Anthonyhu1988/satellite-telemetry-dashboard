import { describe, expect, it } from 'vitest';
import { telemetryInputSchema } from '../src';

const valid = {
  satelliteId: 'SAT-001',
  timestamp: '2026-11-18T10:00:00Z',
  altitude: 550,
  velocity: 7.6,
  status: 'healthy',
};

function errorFor(input: unknown, field: string) {
  const result = telemetryInputSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('telemetryInputSchema', () => {
  it('accepts a valid entry', () => {
    expect(telemetryInputSchema.parse(valid)).toEqual(valid);
  });

  it('accepts timestamps with an explicit offset', () => {
    const result = telemetryInputSchema.safeParse({
      ...valid,
      timestamp: '2026-11-18T10:00:00+02:00',
    });
    expect(result.success).toBe(true);
  });

  it('trims satelliteId and lowercases status', () => {
    const parsed = telemetryInputSchema.parse({
      ...valid,
      satelliteId: '  SAT-9 ',
      status: 'CRITICAL',
    });
    expect(parsed.satelliteId).toBe('SAT-9');
    expect(parsed.status).toBe('critical');
  });

  it.each([
    ['not a date', 'garbage'],
    ['date only', '2026-11-18'],
    ['no timezone', '2026-11-18T10:00:00'],
    ['impossible date', '2026-02-30T10:00:00Z'],
  ])('rejects a timestamp that is %s', (_label, timestamp) => {
    expect(errorFor({ ...valid, timestamp }, 'timestamp')).toBeDefined();
  });

  it('reports a malformed timestamp only once', () => {
    const result = telemetryInputSchema.safeParse({ ...valid, timestamp: 'tomorrow' });
    const timestampIssues = result.error?.issues.filter((i) => i.path[0] === 'timestamp');
    expect(timestampIssues).toHaveLength(1);
  });

  it.each(['altitude', 'velocity'])(
    'rejects zero, negative, NaN, Infinity and string %s',
    (field) => {
      for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '500']) {
        expect(
          errorFor({ ...valid, [field]: bad }, field),
          `${field}=${String(bad)}`,
        ).toBeDefined();
      }
    },
  );

  it('gives a readable message for negative altitude', () => {
    expect(errorFor({ ...valid, altitude: -5 }, 'altitude')).toBe(
      'altitude must be a positive number',
    );
  });

  it('rejects an unknown status', () => {
    expect(errorFor({ ...valid, status: 'on fire' }, 'status')).toMatch(
      /healthy, warning, critical/,
    );
  });

  it('rejects an empty satelliteId', () => {
    expect(errorFor({ ...valid, satelliteId: '   ' }, 'satelliteId')).toBe(
      'satelliteId is required',
    );
  });

  it('reports every missing field', () => {
    const result = telemetryInputSchema.safeParse({});
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((issue) => issue.path[0]).sort();
    expect(fields).toEqual(['altitude', 'satelliteId', 'status', 'timestamp', 'velocity']);
  });

  it('rejects unknown keys', () => {
    expect(telemetryInputSchema.safeParse({ ...valid, temperature: 20 }).success).toBe(false);
  });
});
