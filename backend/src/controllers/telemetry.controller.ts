import type { Request, Response } from 'express';
import type { TelemetryInput } from '@telemetry/shared';
import type { ListTelemetryQuery } from '../schemas/telemetry.schema';
import type { TelemetryService } from '../services/telemetry.service';

// HTTP in, HTTP out. Input is already validated by the time it gets here,
// and any business rules live in the service.
export class TelemetryController {
  constructor(private readonly service: TelemetryService) {}

  list = async (_req: Request, res: Response) => {
    const query = res.locals.query as ListTelemetryQuery;
    res.json(await this.service.list(query));
  };

  summary = async (_req: Request, res: Response) => {
    res.json(await this.service.summary());
  };

  getById = async (_req: Request, res: Response) => {
    res.json(await this.service.getById(res.locals.params.id));
  };

  create = async (_req: Request, res: Response) => {
    const created = await this.service.create(res.locals.body as TelemetryInput);
    res.status(201).location(`/telemetry/${created.id}`).json(created);
  };

  remove = async (_req: Request, res: Response) => {
    await this.service.remove(res.locals.params.id);
    res.status(204).end();
  };
}
