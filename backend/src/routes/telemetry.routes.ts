import { Router } from 'express';
import type { TelemetryController } from '../controllers/telemetry.controller';
import { validate } from '../middleware/validate';
import {
  createTelemetrySchema,
  idParamsSchema,
  listTelemetryQuerySchema,
} from '../schemas/telemetry.schema';

export function telemetryRoutes(controller: TelemetryController) {
  const router = Router();

  router.get('/', validate({ query: listTelemetryQuerySchema }), controller.list);
  // has to be registered before /:id or "summary" would be treated as an id
  router.get('/summary', controller.summary);
  router.get('/:id', validate({ params: idParamsSchema }), controller.getById);
  router.post('/', validate({ body: createTelemetrySchema }), controller.create);
  router.delete('/:id', validate({ params: idParamsSchema }), controller.remove);

  return router;
}
