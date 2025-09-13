import http, { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import type { RequestHandler, RouteMap, Middleware } from '@root/src/types';

export class HttpServer {
  private server: http.Server;
  private routes: RouteMap = {};
  private middlewares: Middleware[] = [];

  constructor(private port: number) {
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  public use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  public start(): void {
    this.server.listen(this.port, () => {
      console.log(`HTTP server is listening on port ${this.port}`);
    });
  }

  public on(method: string, path: string, handler: RequestHandler): void {
    const upperMethod = method.toUpperCase();
    if (!this.routes[upperMethod]) {
      this.routes[upperMethod] = {};
    }
    this.routes[upperMethod][path] = handler;
  }

  public useRoutes(routes: RouteMap): void {
    for (const method of Object.keys(routes)) {
      for (const path of Object.keys(routes[method])) {
        this.on(method, path, routes[method][path]);
      }
    }
  }

  public stop(): void {
    this.server.close(() => {
      console.log('HTTP server stopped');
    });
  }

  public attach(server: http.Server): void {
    server.on('request', this.handleRequest.bind(this));
  }

  private matchRoute(
    pathname: string,
    routePath: string
  ): { params: Record<string, string> } | null {
    const routeRegex = routePath
      .replace(/:(\w+)/g, '([^/]+)') 
      .replace(/\//g, '\\/');
    const regex = new RegExp(`^${routeRegex}$`);
    const match = pathname.match(regex);

    if (!match) return null;

    const keys = routePath.match(/:(\w+)/g) || [];
    const params: Record<string, string> = {};

    keys.forEach((key, index) => {
      params[key.substring(1)] = match[index + 1];
    });

    return { params };
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const method = req.method?.toUpperCase() || '';
    const pathname = parse(req.url || '', true).pathname || '';

    const handler = this.findRoute(method, pathname);
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Route not found' }));
      return;
    }

    const composed = [...this.middlewares, handler];

    let i = 0;
    const next = async (): Promise<void> => {
      const middleware = composed[i++];
      if (middleware) {
        await middleware(req, res, next);
      } else {
        await handler(req, res);
      }
    };

    try {
      await next();
    } catch (err) {
      console.error(`Error handling ${method} ${pathname}:`, err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  private findRoute(method: string, pathname: string): RequestHandler | null {
    const routePaths = this.routes[method] || {};

    for (const path of Object.keys(routePaths)) {
      const match = this.matchRoute(pathname, path);
      if (match) {
        const handler = routePaths[path];
        return (req: IncomingMessage, res: ServerResponse) => {
          req.params = match.params; 
          return handler(req, res);
        };
      }
    }

    return null;
  }
}
