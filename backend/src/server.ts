import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);

const app = await createApp({
  seed: process.env.SEED !== 'false',
  logging: process.env.NODE_ENV !== 'test',
});

const server = app.listen(port, () => {
  console.log(`Telemetry API listening on http://localhost:${port} (docs at /docs)`);
});

// docker stop sends SIGTERM; close cleanly instead of waiting for the 10s kill
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
