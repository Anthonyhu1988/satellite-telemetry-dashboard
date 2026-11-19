import { randomUUID } from 'node:crypto';
import {
  STATUSES,
  type Paginated,
  type SortField,
  type SortOrder,
  type Telemetry,
  type TelemetryInput,
  type TelemetryStatus,
  type TelemetrySummary,
} from '@telemetry/shared';
import { NotFoundError } from '../errors/AppError';
import type { TelemetryGateway } from '../gateways/telemetry.gateway';

export const DEFAULT_PAGE_SIZE = 20;

export interface ListOptions {
  satelliteId?: string;
  status?: TelemetryStatus;
  sortBy?: SortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

export class TelemetryService {
  constructor(
    private readonly gateway: TelemetryGateway,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(options: ListOptions = {}): Promise<Paginated<Telemetry>> {
    const sortBy = options.sortBy ?? 'timestamp';
    const order = options.order ?? 'desc';
    const filters = { satelliteId: options.satelliteId, status: options.status, sortBy, order };

    // The brief says GET /telemetry returns "all" data, and pagination is a bonus on top.
    // So paging only kicks in when the client asks for it with page or limit.
    const paged = options.page !== undefined || options.limit !== undefined;
    if (!paged) {
      const { rows, total } = await this.gateway.findAll(filters);
      return {
        data: rows,
        pagination: { page: 1, limit: total, total, totalPages: total > 0 ? 1 : 0 },
      };
    }

    const page = options.page ?? 1;
    const limit = options.limit ?? DEFAULT_PAGE_SIZE;
    const { rows, total } = await this.gateway.findAll({
      ...filters,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string): Promise<Telemetry> {
    const entry = await this.gateway.findById(id);
    if (!entry) throw new NotFoundError(`Telemetry entry ${id} not found`);
    return entry;
  }

  async create(input: TelemetryInput): Promise<Telemetry> {
    return this.gateway.insert({
      ...input,
      id: randomUUID(),
      // store everything in UTC so timestamp sorting works across different offsets
      timestamp: new Date(input.timestamp).toISOString(),
      createdAt: this.now().toISOString(),
    });
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.gateway.delete(id);
    if (!deleted) throw new NotFoundError(`Telemetry entry ${id} not found`);
  }

  async summary(): Promise<TelemetrySummary> {
    const [counts, satellites] = await Promise.all([
      this.gateway.countByStatus(),
      this.gateway.listSatelliteIds(),
    ]);
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, counts[s] ?? 0])) as Record<
      TelemetryStatus,
      number
    >;
    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
    return { total, byStatus, satellites };
  }
}
