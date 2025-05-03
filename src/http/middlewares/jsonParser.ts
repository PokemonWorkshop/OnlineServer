import { IncomingMessage, ServerResponse } from 'http';

/**
 * Middleware to parse JSON request bodies for HTTP methods POST, PUT, and PATCH.
 *
 * This middleware checks if the `Content-Type` header of the incoming request
 * includes `application/json`. If so, it reads the request body as a stream,
 * concatenates the chunks, and attempts to parse it as JSON. If the parsing
 * fails, it responds with a 400 status code and an error message.
 *
 * @param req - The HTTP request object.
 * @param res - The HTTP response object.
 * @param next - The next middleware function in the chain.
 */
const JsonParser = async (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => Promise<void> // Correction du type "voi" en "void"
) => {
  if (
    ['POST', 'PUT', 'PATCH'].includes(req.method || '') &&
    req.headers['content-type']?.includes('application/json') // Correction de "hearders" en "headers"
  ) {
    const buffers: Buffer[] = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    try {
      // Cast req pour ajouter la propriété body
      (req as any).body = JSON.parse(Buffer.concat(buffers).toString()); // "req" étendu avec "body"
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
  }
  await next();
};

export { JsonParser };
