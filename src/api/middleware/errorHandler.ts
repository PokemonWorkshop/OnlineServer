import Koa from 'koa';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
/**
 * Error codes used in the application.
 */
export type ErrorCode =
  | 'PLAYER_RETRIEVAL_ERROR'
  | 'INTERNAL_ERROR'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'GIFT_CREATION_ERROR'
  | 'BAD_REQUEST';

/**
 * Custom error interface extending the default Error object.
 * Includes additional properties for enhanced error handling.
 *
 * @interface KoaError
 * @extends {Error}
 */
export interface KoaError extends Error {
  // Optional HTTP status code for the error.
  status?: number;
  // Optional error code.
  code?: ErrorCode;
  // Optional additional details about the error.
  details?: unknown;
  // Optional flag to indicate if the error is critical.
  critical?: boolean;
}

/**
 * Middleware function for handling errors in Koa applications.
 * Catches any errors thrown by downstream middleware and sets the appropriate HTTP response.
 *
 * @param {Koa.ParameterizedContext} ctx - The Koa context object, which contains information about the request and response.
 * @param {Koa.Next} next - The next middleware function to be executed.
 * @returns {Promise<void>} A promise that resolves when the next middleware function completes.
 *
 * @throws {KoaError} Logs the error details, sets the response status and body based on the error.
 */

export const errorHandler: Koa.Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      ctx.status = 401;
      ctx.body = {
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
      };
    } else if (err instanceof JsonWebTokenError) {
      ctx.status = 403;
      ctx.body = {
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
      };
    } else {
      const error = err as KoaError;
      ctx.status = error.status || 500;
      ctx.body = {
        message: error.message || 'Internal Server Error',
        code: error.code || 'INTERNAL_ERROR',
        ...(error.details ? { details: error.details } : {}),
      };
      console.error(
        `${error.message}\nStatus: ${ctx.status}\nDetails:`,
        JSON.stringify(error.details, null, 2)
      );
      if (error.critical) {
        console.error('Critical Error Occurred!');
      }
    }
  }
};
