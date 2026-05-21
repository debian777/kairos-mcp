import type { Express } from 'express';

export function setupMcpCorsRoutes(app: Express): void {
  app.use('/mcp', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Expose-Headers', 'WWW-Authenticate');
    }
    next();
  });

  app.options('/mcp', (req, res) => {
    const origin = req.headers.origin;
    if (origin) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Expose-Headers', 'WWW-Authenticate');
    } else {
      res.set('Access-Control-Allow-Origin', '*');
    }
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version');
    res.set('Access-Control-Max-Age', '86400');
    res.status(204).end();
  });
}
