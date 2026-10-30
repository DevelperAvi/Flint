import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

interface AppError extends Error {
  statusCode?: number;
  validation?: unknown;
}

export function errorHandler(
  error: AppError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  request.log.error({ err: error }, error.message);

  // Zod validation errors
  if (error instanceof ZodError) {
    reply.status(422).send({
      error: 'Validation Error',
      message: 'Request validation failed',
      details: error.flatten().fieldErrors,
    });
    return;
  }

  // Fastify validation errors (AJV)
  if (error.validation) {
    reply.status(422).send({
      error: 'Validation Error',
      message: 'Request schema validation failed',
      details: error.validation,
    });
    return;
  }

  // Prisma known errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const fields = (error.meta?.target as string[]) ?? [];
      reply.status(409).send({
        error: 'Conflict',
        message: `A record with this ${fields.join(', ')} already exists`,
      });
      return;
    }

    if (error.code === 'P2025') {
      reply.status(404).send({
        error: 'Not Found',
        message: 'The requested resource does not exist',
      });
      return;
    }
  }

  // JWT errors
  if (error.message?.includes('jwt')) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
    return;
  }

  // HTTP status from custom errors
  if (error.statusCode) {
    reply.status(error.statusCode).send({
      error: 'Error',
      message: error.message,
    });
    return;
  }

  // Generic 500
  reply.status(500).send({
    error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message,
  });
}

/**
 * Create a typed HTTP error with a status code.
 */
export function createError(statusCode: number, message: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  return err;
}
