import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ValidationError } from '../errors/AppError';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

// Parsed values go on res.locals rather than back onto req, because Express 5
// made req.query a read-only getter.
export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    const details: { field: string; message: string }[] = [];

    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        res.locals[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({
            field: issue.path.join('.') || part,
            message:
              issue.code === 'unrecognized_keys'
                ? `Unknown field(s): ${issue.keys.join(', ')}`
                : issue.message,
          });
        }
      }
    }

    if (details.length) return next(new ValidationError(details));
    next();
  };
}
