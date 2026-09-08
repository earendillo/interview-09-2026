import { createServer as createHttpServer, type Server } from 'node:http';
import { route } from './router';

export function createServer(): Server {
  return createHttpServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    const { status, body } = route(req.method ?? 'GET', pathname);

    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });
}
