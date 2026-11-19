import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../src/errors/AppError';
import { errorHandler, notFoundHandler } from '../src/middleware/errorHandler';
import { validate } from '../src/middleware/validate';

function buildApp(route: (app: express.Express) => void) {
  const app = express();
  app.use(express.json());
  route(app);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('validate middleware', () => {
  const app = buildApp((a) =>
    a.post(
      '/things',
      validate({ body: z.object({ name: z.string().min(1, 'name is required') }).strict() }),
      (_req, res) => {
        res.json({ parsed: res.locals.body });
      },
    ),
  );

  it('passes the parsed body on through res.locals', async () => {
    const res = await request(app).post('/things').send({ name: 'x' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ parsed: { name: 'x' } });
  });

  it('returns 400 with field-level details', async () => {
    const res = await request(app).post('/things').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [{ field: 'name', message: 'name is required' }],
      },
    });
  });

  it('names unknown fields', async () => {
    const res = await request(app).post('/things').send({ name: 'x', extra: 1 });
    expect(res.body.error.details[0].message).toBe('Unknown field(s): extra');
  });
});

describe('errorHandler', () => {
  it('maps NotFoundError to 404', async () => {
    const app = buildApp((a) =>
      a.get('/missing', () => {
        throw new NotFoundError('gone');
      }),
    );
    const res = await request(app).get('/missing');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'gone' } });
  });

  it('returns 400 for malformed JSON', async () => {
    const app = buildApp((a) => a.post('/x', (_req, res) => res.end()));
    const res = await request(app)
      .post('/x')
      .set('Content-Type', 'application/json')
      .send('{"broken"');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('hides internals on unexpected errors', async () => {
    const app = buildApp((a) =>
      a.get('/boom', () => {
        throw new Error('db password is hunter2');
      }),
    );
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(buildApp(() => {})).get('/nowhere');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('No route for GET /nowhere');
  });
});
