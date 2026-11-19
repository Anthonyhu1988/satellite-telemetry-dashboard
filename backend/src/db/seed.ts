import { randomUUID } from 'node:crypto';
import type { Telemetry, TelemetryStatus } from '@telemetry/shared';
import type { TelemetryGateway } from '../gateways/telemetry.gateway';

const SATELLITES = [
  { id: 'SAT-001', altitude: 550, velocity: 7.59 },
  { id: 'SAT-002', altitude: 420, velocity: 7.66 },
  { id: 'SAT-003', altitude: 780, velocity: 7.46 },
  { id: 'SAT-004', altitude: 500, velocity: 7.61 },
  { id: 'SAT-005', altitude: 1200, velocity: 7.25 },
];

// small seeded PRNG so the demo data looks random but is the same on every boot
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSeedData(count = 30, now = new Date()): Telemetry[] {
  const rand = mulberry32(42);
  const entries: Telemetry[] = [];

  for (let i = 0; i < count; i++) {
    const sat = SATELLITES[i % SATELLITES.length]!;
    const roll = rand();
    const status: TelemetryStatus = roll < 0.7 ? 'healthy' : roll < 0.9 ? 'warning' : 'critical';
    // spread readings over the last 48h, newest first
    const timestamp = new Date(now.getTime() - i * 96 * 60 * 1000);

    entries.push({
      id: randomUUID(),
      satelliteId: sat.id,
      timestamp: timestamp.toISOString(),
      altitude: Math.round((sat.altitude + (rand() - 0.5) * 20) * 100) / 100,
      velocity: Math.round((sat.velocity + (rand() - 0.5) * 0.05) * 1000) / 1000,
      status,
      createdAt: now.toISOString(),
    });
  }
  return entries;
}

export async function seed(gateway: TelemetryGateway, count?: number) {
  for (const entry of buildSeedData(count)) {
    await gateway.insert(entry);
  }
}
