/**
 * Vite plugin that serves Vercel API routes locally during development.
 * Intercepts /api/pipeline/* requests and executes the TypeScript handlers.
 */
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';

export function vercelApiPlugin(): Plugin {
  return {
    name: 'vercel-api-dev',
    configureServer(server: ViteDevServer) {
      // Load .env.local for DEEPSEEK_API_KEY
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        for (const line of envContent.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
              const key = trimmed.slice(0, eqIdx);
              const value = trimmed.slice(eqIdx + 1);
              if (!process.env[key]) {
                process.env[key] = value;
              }
            }
          }
        }
      }

      // Middleware to handle API routes
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url || '';
        if (!url.startsWith('/api/pipeline/')) {
          return next();
        }

        // Only handle POST and OPTIONS
        if (req.method !== 'POST' && req.method !== 'OPTIONS') {
          return next();
        }

        // Extract the handler file path
        // /api/pipeline/step1-audit → api/pipeline/step1-audit.ts
        const routePath = url.split('?')[0];
        const handlerFile = path.resolve(process.cwd(), routePath.slice(1) + '.ts');

        if (!fs.existsSync(handlerFile)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Handler not found: ${routePath}` }));
          return;
        }

        try {
          // Read and parse request body
          let body = '';
          await new Promise<void>((resolve) => {
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', resolve);
          });

          // Dynamic import the handler (uses tsx via Vite's SSR module loading)
          const mod = await server.ssrLoadModule(handlerFile);
          const handler = mod.default;

          if (typeof handler !== 'function') {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Handler does not export a default function' }));
            return;
          }

          // Create mock VercelRequest
          const mockReq = {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: body ? JSON.parse(body) : undefined,
            query: {},
          };

          // Create mock VercelResponse with streaming support
          let statusCode = 200;
          const headers: Record<string, string> = {};
          let ended = false;

          const mockRes = {
            status(code: number) {
              statusCode = code;
              return mockRes;
            },
            setHeader(name: string, value: string) {
              headers[name.toLowerCase()] = value;
              return mockRes;
            },
            flushHeaders() {
              res.statusCode = statusCode;
              for (const [k, v] of Object.entries(headers)) {
                res.setHeader(k, v);
              }
            },
            write(chunk: string) {
              if (!ended) {
                if (res.statusCode !== statusCode) res.statusCode = statusCode;
                // Ensure headers are sent
                if (!res.headersSent) {
                  for (const [k, v] of Object.entries(headers)) {
                    res.setHeader(k, v);
                  }
                }
                res.write(chunk);
              }
              return true;
            },
            end(chunk?: string) {
              if (!ended) {
                ended = true;
                if (chunk) {
                  mockRes.write(chunk);
                }
                if (!res.headersSent) {
                  res.statusCode = statusCode;
                  for (const [k, v] of Object.entries(headers)) {
                    res.setHeader(k, v);
                  }
                }
                res.end();
              }
            },
            json(data: unknown) {
              mockRes.setHeader('Content-Type', 'application/json');
              mockRes.end(JSON.stringify(data));
            },
          };

          await handler(mockReq, mockRes);
        } catch (err) {
          console.error(`[API Error] ${url}:`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }));
          }
        }
      });
    },
  };
}
