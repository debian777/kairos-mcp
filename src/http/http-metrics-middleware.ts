import express from 'express';
import {
  httpRequests,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  httpActiveConnections
} from '../services/metrics/http-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';

/**
 * HTTP metrics middleware for Prometheus
 * Tracks requests, response times, payload sizes, and active connections
 */
export function httpMetricsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const tenantId = getTenantId(req);
  const method = req.method;
  const route = req.route?.path || req.path;
  
  // Track request size
  const requestSize = req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : 0;
  if (requestSize > 0) {
    httpRequestSize.observe({ method, route, tenant_id: tenantId }, requestSize);
  }
  
  // Increment active connections
  httpActiveConnections.inc({ tenant_id: tenantId });
  
  // Start duration timer
  const timer = httpRequestDuration.startTimer({ 
    method, 
    route, 
    tenant_id: tenantId 
  });
  
  // Track response size
  const originalSend = res.send;
  res.send = function(body: any) {
    const responseSize = typeof body === 'string' ? Buffer.byteLength(body) : JSON.stringify(body).length;
    httpResponseSize.observe({ 
      method, 
      route, 
      status: res.statusCode.toString(),
      tenant_id: tenantId 
    }, responseSize);
    return originalSend.call(this, body);
  };
  
  res.on('finish', () => {
    // Track request
    httpRequests.inc({ 
      method, 
      route, 
      status: res.statusCode.toString(),
      tenant_id: tenantId 
    });
    
    // End duration timer
    timer({ 
      method, 
      route, 
      status: res.statusCode.toString(),
      tenant_id: tenantId 
    });
    
    // Decrement active connections
    httpActiveConnections.dec({ tenant_id: tenantId });
  });
  
  next();
}

