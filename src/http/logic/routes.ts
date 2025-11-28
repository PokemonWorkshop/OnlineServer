import { RouteMap, RequestHandler } from '@root/src/types';

declare module 'http' {
  interface IncomingMessage {
    params: { [key: string]: string | undefined };
  }
}

export const routes: RouteMap = {
  GET: {},
  POST: {},
  PUT: {},
  DELETE: {},
};

/**
 * Registers a new route.
 * @param method The HTTP method for the route (GET, POST, etc.)
 * @param path The path for the route
 * @param handler The request handler for the route
 */
export function registerRoute(
  method: keyof RouteMap,
  path: string,
  handler: RequestHandler
) {
  if (!routes[method]) routes[method] = {};
  routes[method][path] = handler;
}
