import { Context, Next } from 'koa';
import { verify } from 'jsonwebtoken';
import { SERVER_SECRET } from '@config/PocketNet.json';

const VALID_TOKEN = process.env.TOKEN_Online;

/**
 * Middleware function to authenticate requests using JSON Web Tokens (JWT).
 * Checks if the request has a valid token and proceeds accordingly.
 *
 * @param {Context} ctx - The Koa context object, which contains information about the request and response.
 * @param {Next} next - The next middleware function to be executed if the token is valid.
 * @returns {Promise<void>} A promise that resolves when the next middleware function completes.
 */
export const authenticateToken = async (ctx: Context, next: Next) => {
  const authHeader = ctx.request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    ctx.status = 401;
    ctx.body = {
      message: 'Token not found',
      code: 'MISSING_TOKEN',
    };
    return;
  }

  try {
    verify(token, SERVER_SECRET);

    if (token !== VALID_TOKEN) {
      ctx.status = 403;
      ctx.body = {
        message: 'Access denied. The token is no longer valid.',
        code: 'INVALID_TOKEN',
      };
      return;
    }

    await next();
  } catch (err) {
    ctx.status = 403;
    ctx.body = {
      message: 'Access denied. The token is invalid.',
      code: 'INVALID_TOKEN',
    };
  }
};
