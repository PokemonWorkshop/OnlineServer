import { IncomingMessage, ServerResponse } from 'http';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
interface JsonObject {
  [key: string]: JsonValue;
}
interface JsonArray extends Array<JsonValue> {}

declare module 'http' {
  interface IncomingMessage {
    body?: JsonValue;
    params: { [key: string]: string | undefined };
  }
}

/**
 * Middleware function to parse JSON request bodies for HTTP methods POST, PUT, and PATCH.
 *
 * @param req - The incoming HTTP request object.
 * @param res - The outgoing HTTP response object.
 * @param next - A function to invoke the next middleware in the chain.
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
      req.body = JSON.parse(Buffer.concat(buffers).toString()) as JsonValue;
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
  }
  await next();
};

export { JsonParser, JsonValue };
