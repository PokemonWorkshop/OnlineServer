import { IncomingMessage, ServerResponse } from 'http';

/**
 * Middleware function to parse JSON request bodies for HTTP methods POST, PUT, and PATCH.
 *
 * This middleware checks if the incoming request has a `Content-Type` header
 * indicating `application/json`. If so, it reads the request body, parses it as JSON,
 * and attaches the parsed object to the `body` property of the `req` object.
 *
 * If the JSON parsing fails, it responds with a 400 status code and an error message.
 * Otherwise, it invokes the `next` function to pass control to the next middleware.
 *
 * @param req - The incoming HTTP request object.
 * @param res - The outgoing HTTP response object.
 * @param next - A function to invoke the next middleware in the chain.
 *
 * @throws Responds with a 400 status code if the JSON body is invalid.
 */
const JsonParser = async (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => Promise<void>
) => {
  if (
    ['POST', 'PUT', 'PATCH'].includes(req.method || '') &&
    req.headers['content-type']?.includes('application/json')
  ) {
    const buffers: Buffer[] = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    try {
      (req as any).body = JSON.parse(Buffer.concat(buffers).toString());
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
  }
  await next();
};

export { JsonParser };
