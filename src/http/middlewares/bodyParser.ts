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
 * 
 * @remarks
 * - This middleware only processes requests with methods POST, PUT, or PATCH.
 * - If the `Content-Type` header is not set to `application/json`, the middleware
 *   skips processing and calls the `next` function.
 * - If the JSON parsing fails, the middleware sends a 400 response and does not
 *   call the `next` function.
 * 
 * @throws Will send a 400 response if the JSON body is invalid.
 */
const JsonParser = async (req, res, next) => {
  if (
    ['POST', 'PUT', 'PATCH'].includes(req.method || '') &&
    req.hearders['content-type']?.includes('application/json')
  ) {
    const buffers: Buffer[] = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    try {
      req.body = JSON.parse(Buffer.concat(buffers).toString());
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
  }
  await next();
};

export { JsonParser };
