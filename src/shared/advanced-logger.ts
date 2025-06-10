import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

// Advanced logging with structured format for production monitoring
export class AdvancedLogger {
  private logger: winston.Logger;
  private serviceName: string;
  private version: string;

  constructor(serviceName: string, version: string = '1.0.0') {
    this.serviceName = serviceName;
    this.version = version;
    
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(this.formatLog.bind(this))
      ),
      defaultMeta: {
        service: serviceName,
        version: version,
        environment: process.env.NODE_ENV || 'development',
        hostname: require('os').hostname(),
        pid: process.pid
      },
      transports: [
        // Console output with colors for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        
        // Structured JSON logs for production
        new winston.transports.File({
          filename: `logs/${serviceName}-app.log`,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }),
        
        // Error logs separate file
        new winston.transports.File({
          filename: `logs/${serviceName}-error.log`,
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }),
        
        // Performance logs
        new winston.transports.File({
          filename: `logs/${serviceName}-performance.log`,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      ]
    });
  }

  private formatLog(info: any): string {
    const { timestamp, level, message, service, version, ...meta } = info;
    
    const logEntry = {
      '@timestamp': timestamp,
      level: level.toUpperCase(),
      service,
      version,
      message,
      ...meta
    };

    return JSON.stringify(logEntry);
  }

  // Request/Response logging with correlation IDs
  logRequest(req: any, metadata: any = {}) {
    const correlationId = req.headers['x-correlation-id'] || uuidv4();
    req.correlationId = correlationId;

    this.logger.info('HTTP Request', {
      type: 'http_request',
      correlationId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      clientIp: req.ip,
      contentLength: req.headers['content-length'],
      ...metadata
    });

    return correlationId;
  }

  logResponse(req: any, res: any, responseTime: number, metadata: any = {}) {
    this.logger.info('HTTP Response', {
      type: 'http_response',
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('content-length'),
      ...metadata
    });
  }

  // Performance monitoring
  logPerformance(operation: string, duration: number, metadata: any = {}) {
    const level = duration > 1000 ? 'warn' : 'info';
    
    this.logger.log(level, 'Performance Metric', {
      type: 'performance',
      operation,
      duration: `${duration}ms`,
      slow: duration > 1000,
      ...metadata
    });
  }

  // Business events logging
  logBusinessEvent(event: string, details: any = {}) {
    this.logger.info('Business Event', {
      type: 'business_event',
      event,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  // Error logging with context
  logError(error: Error, context: any = {}) {
    this.logger.error('Application Error', {
      type: 'error',
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...context
    });
  }

  // Security events
  logSecurity(event: string, details: any = {}) {
    this.logger.warn('Security Event', {
      type: 'security',
      event,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  // System health metrics
  logHealthMetrics(metrics: any) {
    this.logger.info('Health Metrics', {
      type: 'health_metrics',
      ...metrics,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }

  // Database operations
  logDatabase(operation: string, duration: number, query?: string, metadata: any = {}) {
    this.logger.info('Database Operation', {
      type: 'database',
      operation,
      duration: `${duration}ms`,
      query: query ? query.substring(0, 500) : undefined, // Truncate long queries
      slow: duration > 500,
      ...metadata
    });
  }

  // External API calls
  logExternalAPI(service: string, operation: string, duration: number, statusCode?: number, metadata: any = {}) {
    this.logger.info('External API Call', {
      type: 'external_api',
      service,
      operation,
      duration: `${duration}ms`,
      statusCode,
      success: statusCode ? statusCode < 400 : undefined,
      ...metadata
    });
  }

  // Cache operations
  logCache(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, metadata: any = {}) {
    this.logger.info('Cache Operation', {
      type: 'cache',
      operation,
      key: key.substring(0, 100), // Truncate long keys
      ...metadata
    });
  }

  // Create child logger with additional context
  child(context: any) {
    return {
      info: (message: string, meta: any = {}) => this.logger.info(message, { ...context, ...meta }),
      warn: (message: string, meta: any = {}) => this.logger.warn(message, { ...context, ...meta }),
      error: (message: string, meta: any = {}) => this.logger.error(message, { ...context, ...meta }),
      debug: (message: string, meta: any = {}) => this.logger.debug(message, { ...context, ...meta })
    };
  }

  // Get the underlying winston logger for advanced usage
  getLogger() {
    return this.logger;
  }
}

// Performance timing utility
export class PerformanceTimer {
  private startTime: number;
  private logger: AdvancedLogger;
  private operation: string;

  constructor(logger: AdvancedLogger, operation: string) {
    this.logger = logger;
    this.operation = operation;
    this.startTime = performance.now();
  }

  end(metadata: any = {}) {
    const duration = performance.now() - this.startTime;
    this.logger.logPerformance(this.operation, duration, metadata);
    return duration;
  }
}

// Express middleware for request/response logging
export function createLoggingMiddleware(logger: AdvancedLogger) {
  return (req: any, res: any, next: any) => {
    const startTime = performance.now();
    
    // Log incoming request
    const correlationId = logger.logRequest(req);
    
    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(body: any) {
      const responseTime = performance.now() - startTime;
      logger.logResponse(req, res, responseTime);
      return originalJson.call(this, body);
    };

    // Override res.send to log response
    const originalSend = res.send;
    res.send = function(body: any) {
      const responseTime = performance.now() - startTime;
      logger.logResponse(req, res, responseTime);
      return originalSend.call(this, body);
    };

    next();
  };
}

// Create logger instances for each service
export const createServiceLogger = (serviceName: string) => {
  return new AdvancedLogger(serviceName);
};

export default AdvancedLogger;