// Standalone node HTTP server exposing the same billing router as the Netlify
// function — for local runs. Run: `node billing/server.mjs` (PORT, default 8788).
import http from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { handler } from '../netlify/functions/chargebee.mjs';

export function createBillingServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = `http://${req.headers.host || 'localhost'}${req.url}`;
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        ...(hasBody
          ? { body: Readable.toWeb(req), duplex: 'half' }
          : {}),
      });
      const response = await handler(request);

      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      res.writeHead(response.status, headers);
      if (!response.body) {
        res.end();
        return;
      }
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        res.end();
      }
    } catch (err) {
      console.error('[billing server]', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      }
      res.end(JSON.stringify({ error: 'internal error' }));
    }
  });
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const port = Number(process.env.PORT) || 8788;
  createBillingServer().listen(port, () => {
    console.log(`billing server listening on http://localhost:${port}`);
  });
}
