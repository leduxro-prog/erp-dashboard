import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Tracer, ITracer } from '../utils/tracer';
import logger from '../utils/logger';

/**
 * Extended Express Request with tracer context
 */
export interface RequestWithTracer extends Request {
  tracer?: ITracer;
  traceId?: string;
  spanId?: string;
}

/**
 * Distributed tracing middleware for Express applications
 * 
 * Generates trace IDs and attaches a tracer instance to each request.
 * Propagates trace context via X-Trace-ID header in responses.
 * Logs structured JSON trace data for all requests.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function tracingMiddleware(req: RequestWithTracer, res: Response, next: NextFunction): void {
  // Extract trace ID from incoming headers or generate new one
  const incomingTraceId = (req.headers['x-trace-id'] as string) || randomUUID();

  // Create tracer for this request
  const tracer = new Tracer(incomingTraceId);
  req.tracer = tracer;
  req.traceId = incomingTraceId;

  // Generate span ID for request entry point
  const requestSpan = tracer.startSpan('http.request');
  req.spanId = requestSpan.spanId;

  // Set trace ID in response headers for propagation
  res.setHeader('X-Trace-ID', incomingTraceId);
  res.setHeader('X-Span-ID', requestSpan.spanId);

  // Record request metadata
  requestSpan.setAttribute('http.method', req.method);
  requestSpan.setAttribute('http.url', req.url);
  requestSpan.setAttribute('http.target', req.path);
  requestSpan.setAttribute('http.host', req.hostname);
  requestSpan.setAttribute('http.scheme', req.protocol);
  requestSpan.setAttribute('http.client_ip', req.ip || 'unknown');

  // Hook into response to capture status code and log timing
  const originalJson = res.json;
  const originalSend = res.send;

  const captureResponse = (statusCode: number): void => {
    requestSpan.setAttribute('http.status_code', statusCode);

    // Categorize response type
    if (statusCode >= 200 && statusCode < 300) {
      requestSpan.setAttribute('http.status_class', 'success');
    } else if (statusCode >= 300 && statusCode < 400) {
      requestSpan.setAttribute('http.status_class', 'redirect');
    } else if (statusCode >= 400 && statusCode < 500) {
      requestSpan.setAttribute('http.status_class', 'client_error');
    } else {
      requestSpan.setAttribute('http.status_class', 'server_error');
    }

    requestSpan.end();

    // Log structured trace data
    const traceData = {
      trace_id: tracer.getTraceId(),
      span_id: requestSpan.spanId,
      parent_span_id: requestSpan.parentSpanId,
      operation: requestSpan.name,
      duration_ms: requestSpan.duration,
      http: {
        method: req.method,
        path: req.path,
        status_code: statusCode,
        url: req.url,
        user_agent: req.get('user-agent'),
      },
      timestamp: new Date().toISOString(),
    };

    logger.info('Request trace', traceData);
  };

  // Override res.json to capture response
  res.json = function (body: any): Response {
    captureResponse(res.statusCode);
    return originalJson.call(this, body);
  };

  // Override res.send to capture response
  res.send = function (body?: any): Response {
    if (!res.headersSent) {
      captureResponse(res.statusCode);
    }
    return originalSend.call(this, body);
  };

  next();
}

export default tracingMiddleware;
