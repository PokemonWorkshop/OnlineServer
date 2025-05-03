import http, { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import type { RequestHandler, RouteMap } from '@root/src/types';

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

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const method = req.method?.toUpperCase() || '';
    const pathname = parse(req.url || '', true).pathname || '';

    const handler = this.routes[method]?.[pathname];
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Route not found' }));
      return;
    }

    const composed = [...this.middlewares, handler];

    let i = 0;
    const next = async () => {
      if (i < composed.length) {
        const currentHandler = composed[i++];
        await currentHandler(req, res, next);
      }
    };

    try {
      await handler(req, res);
    } catch (err) {
      console.error(`Error handling ${method} ${pathname}:`, err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
}
