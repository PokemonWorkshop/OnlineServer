import { IncomingMessage, ServerResponse } from 'http';
import { verify } from 'jsonwebtoken';

/**
 * Middleware to handle authentication for incoming HTTP requests.
 *
 * This middleware checks for the presence of an `Authorization` token in the request headers.
 * If the token is missing, invalid, or does not match the expected value, it responds with an
 * appropriate HTTP error status and message. If the token is valid, the middleware proceeds
 * to the next handler in the chain.
 *
 * @param req - The incoming HTTP request object.
 * @param res - The outgoing HTTP response object.
 * @param next - A function to call the next middleware or route handler.
 *
 * @throws Will respond with:
 * - 401 Unauthorized if the token is missing or invalid.
 * - 403 Forbidden if the token is valid but does not match the expected value.
 */
const AuthMiddleware = async (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => Promise<void>
) => {
  const token = req.headers['authorization'] as string;

  if (!token) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        code: 'ERR_MISSING_TOKEN',
        message: 'Missing authentication token',
      })
    );
    return;
  }

  try {
    verify(token, process.env.SECRET_KEY_API as string);

    if (token !== process.env.TOKEN_API) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          code: 'ERR_VALID_TOKEN',
          message: 'Access denied. The token is no longer valid.',
        })
      );
      return;
    }
    await next();
  } catch (error) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        code: 'ERR_INVALID_TOKEN',
        message: 'Invalid authentication token',
      })
    );
    return;
  }
};

export { AuthMiddleware };
