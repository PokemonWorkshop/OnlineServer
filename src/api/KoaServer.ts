import Koa from 'koa';
import Router from 'koa-router';
import { requestLogger, authenticateToken } from '@api/middleware/';
import bodyParser from 'koa-bodyparser';
import { Server } from 'http';
import { readdir } from 'fs/promises';
import { join, resolve } from 'path';

/**
 * Represents an HTTP method for routing.
 *
 * @typedef {'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'} HttpMethod
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Defines the structure of a route in the Koa server.
 *
 * @interface Route
 * @property {string} path - The path of the route.
 * @property {HttpMethod} method - The HTTP method for the route.
 * @property {(ctx: Koa.Context) => void} handler - The handler function to be executed for the route.
 * @property {Koa.Middleware[]} [middlewares] - Optional array of middlewares to be executed before the route handler.
 */
interface Route {
  path: string;
  method: HttpMethod;
  handler: (ctx: Koa.Context) => void;
  middlewares?: Koa.Middleware[];
}

/**
 * The Koa server class for managing the server and routing.
 *
 * @class KoaServer
 * @static
 */
class KoaServer {
  // The Koa application instance.
  public static app = new Koa();
  // The Koa Router instance.
  private static router = new Router();
  // Array of registered routes.
  private static routes: Route[] = [];
  // Array of global middlewares.
  private static globalMiddlewares: Koa.Middleware[] = [];
  // The HTTP server instance.
  private static serverInstance: Server | null = null;

  /**
   * Initializes the Koa server.
   * Configures middlewares, routes, starts the server, sets up signal handlers, and configures error handling.
   *
   * @param {Object} options - The options for initializing the server.
   * @param {number} options.port - The port on which the server will listen.
   * @param {string} options.host - The host on which the server will listen.
   */
  public static init({
    port,
    host,
    routes,
  }: {
    port: number;
    host: string;
    routes: Function[];
  }) {
    this.addRoutes(routes);
    this.configureMiddlewares();
    this.configureRoutes();
    this.startServer({ port, host });
  }

  /**
   * Dynamically loads all route files from a specified directory and returns an array of route loader functions.
   *
   * This method imports each route file from the given directory and pushes the default export of each module
   * (assumed to be a route loader function) into an array. The default directory is `'src/api/routes/'` if none is provided.
   *
   * @param {string} [pathDir='src/api/routes/'] - The directory path containing route files. Defaults to `'src/api/routes/'`.
   * @returns {Promise<Function[]>} A promise that resolves to an array of route loader functions.
   */
  public static async defaultRoutes(
    pathDir: string = 'src/api/routes/'
  ): Promise<Function[]> {
    const routes: Function[] = [];

    // Get the absolute path of the directory
    const absolutePath = resolve(pathDir);

    // Read the directory to get all files
    const files = await readdir(absolutePath);

    // Import each file and push the default export (assumed to be a route function) into the routes array
    for (const file of files) {
      const route = await import(join(absolutePath, file));
      routes.push(route.default);
    }

    return routes;
  }

  /**
   * Adds a middleware to the global middlewares array.
   *
   * @param {Koa.Middleware} middleware - The middleware function to be added.
   */
  public static use(middleware: Koa.Middleware) {
    this.globalMiddlewares.push(middleware);
  }

  /**
   * Registers a route with the Koa server.
   *
   * @param {string} path - The path of the route.
   * @param {HttpMethod} method - The HTTP method for the route.
   * @param {(ctx: Koa.Context) => void} handler - The handler function for the route.
   * @param {Koa.Middleware[]} [middlewares=[]] - Optional array of middlewares to be executed before the route handler.
   */
  public static registerRoute(
    path: string,
    method: HttpMethod,
    handler: (ctx: Koa.Context) => void,
    middlewares: Koa.Middleware[] = []
  ) {
    this.routes.push({ path, method, handler, middlewares });
    return this;
  }

  /**
   * Stops the server and closes the HTTP server instance.
   * Logs errors encountered during shutdown and exits the process.
   */
  public static stop() {
    if (this.serverInstance) {
      this.serverInstance.close((err) => {
        if (err) {
          console.error('Error during server shutdown:', err);
          process.exit(1);
        } else {
          console.log('KoaServer: Instance api close.');
          process.exit(0);
        }
      });
    } else {
      console.log('No server instance to stop.');
      process.exit(0);
    }
  }

  /**
   * Adds route loaders to the server.
   * Each route loader is a function that registers routes.
   *
   * @param {Array<() => void>} routeLoaders - An array of functions that load routes.
   */
  private static addRoutes(routeLoaders: Function[]) {
    routeLoaders.forEach((loadRoutes) => loadRoutes());
  }

  /**
   * Configures global and default middlewares.
   */
  private static configureMiddlewares() {
    const middlewares: Koa.Middleware[] = [
      requestLogger,
      authenticateToken,
      bodyParser({
        jsonLimit: '1mb',
      }),
    ];

    middlewares.concat(this.globalMiddlewares).forEach((middleware) => {
      this.app.use(middleware);
    });
  }

  /**
   * Configures routes and adds them to the Koa router.
   */
  private static configureRoutes() {
    for (const route of this.routes) {
      const { path, method, handler, middlewares = [] } = route;

      const methodLowerCase = method.toLowerCase() as
        | 'get'
        | 'post'
        | 'put'
        | 'patch'
        | 'delete';
      this.router[methodLowerCase](path, ...middlewares, handler);
    }

    this.app.use(this.router.routes());
    this.app.use(this.router.allowedMethods());
  }

  /**
   * Starts the HTTP server and listens on the specified port and host.
   *
   * @param {Object} options - The options for starting the server.
   * @param {number} options.port - The port on which the server will listen.
   * @param {string} options.host - The host on which the server will listen.
   */
  private static startServer({ port, host }: { port: number; host: string }) {
    this.serverInstance = this.app.listen(port, host, () => {
      console.log(`Server is running on http://${host}:${port}`);
    });
  }
}

export default KoaServer;
