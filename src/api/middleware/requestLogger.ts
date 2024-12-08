import Koa from 'koa';

/**
 * Middleware function for logging request details.
 * Logs the HTTP method, URL, response time, and status code of each request.
 *
 * @param {Koa.ParameterizedContext} ctx - The Koa context object, which contains information about the request and response.
 * @param {Koa.Next} next - The next middleware function to be executed.
 * @returns {Promise<void>} A promise that resolves when the next middleware function completes.
 *
 * @throws {Error} Rethrows any error encountered during request processing and logs it.
 */
export const requestLogger: Koa.Middleware = async (ctx, next) => {
  const start = Date.now();
  const method = ctx.method;
  const url = ctx.url;

  try {
    await next();
  } catch (error) {
    console.error(`${method} ${url} - Error occurred - Status: ${ctx.status}`);
    console.error('Error details:', error);
    throw error;
  } finally {
    const ms = Date.now() - start;
    const status = ctx.response.status;

    console[
      status >= 200 && status < 300
        ? 'log'
        : status >= 300 && status < 400
        ? 'warn'
        : 'error'
    ](`${method} ${url} - ${ms}ms - Status: ${status}`);
  }
};
