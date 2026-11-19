import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { TelemetryController } from './controllers/telemetry.controller';
import { createDatabase } from './db/connection';
import { seed as seedData } from './db/seed';
import { SqliteTelemetryGateway } from './db/sqlite-telemetry.gateway';
import { openApiSpec } from './docs/openapi';
import type { TelemetryGateway } from './gateways/telemetry.gateway';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { telemetryRoutes } from './routes/telemetry.routes';
import { TelemetryService } from './services/telemetry.service';

export interface AppOptions {
  gateway?: TelemetryGateway;
  seed?: boolean;
  logging?: boolean;
}

// The one place where the layers get wired together (db -> gateway -> service ->
// controller -> routes). Tests call this with a fresh gateway each time.
export async function createApp(options: AppOptions = {}) {
  const gateway = options.gateway ?? new SqliteTelemetryGateway(createDatabase());
  if (options.seed) await seedData(gateway);

  const controller = new TelemetryController(new TelemetryService(gateway));
  const app = express();

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  if (options.logging) app.use(pinoHttp());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/docs.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use('/telemetry', telemetryRoutes(controller));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
