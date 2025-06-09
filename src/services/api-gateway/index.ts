import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import winston from 'winston';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import WebSocket from 'ws';
import axios from 'axios';
import { EventEmitter } from 'events';

dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'api-gateway.log' }),
    new winston.transports.File({ filename: 'api-gateway-error.log', level: 'error' })
  ]
});

// Event emitter for service coordination
const orchestrationEvents = new EventEmitter();

// Express app setup
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// Compression and parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Redis for caching and session management
let redis: any;
try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryDelayOnFailedAttempt: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 5000
  });
  
  redis.on('connect', () => {
    logger.info('Redis connected successfully');
  });
  
  redis.on('error', (error) => {
    logger.warn('Redis connection error:', error.message);
    logger.warn('Switching to Mock Redis mode');
  });

  // Test connection with timeout
  Promise.race([
    redis.ping(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000))
  ]).catch(() => {
    logger.warn('Redis connection failed, using Mock Redis');
    redis = createMockRedis();
  });

} catch (error) {
  logger.error('Redis initialization failed:', error);
  redis = createMockRedis();
}

// Mock Redis for development
function createMockRedis() {
  logger.info('Using Mock Redis for development');
  return {
    setex: (key, ttl, value) => {
      logger.debug(`Mock Redis SETEX: ${key} = ${value} (TTL: ${ttl}s)`);
      return Promise.resolve('OK');
    },
    get: (key) => {
      logger.debug(`Mock Redis GET: ${key}`);
      return Promise.resolve(null);
    },
    del: (key) => {
      logger.debug(`Mock Redis DEL: ${key}`);
      return Promise.resolve(1);
    },
    disconnect: () => {
      logger.debug('Mock Redis disconnect');
      return Promise.resolve();
    },
    ping: () => {
      logger.debug('Mock Redis ping');
      return Promise.resolve('PONG');
    },
    on: () => {}, // Empty event handler
    off: () => {} // Empty event handler
  };
}

// Service registry
interface ServiceConfig {
  name: string;
  url: string;
  health: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  version: string;
  capabilities: string[];
}

class ServiceRegistry {
  private services: Map<string, ServiceConfig> = new Map();
  private healthCheckInterval: NodeJS.Timeout;

  constructor() {
    this.initializeServices();
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000); // Health check every 30 seconds
  }

  private initializeServices() {
    const services = [
      {
        name: 'hr-resource',
        url: process.env.HR_SERVICE_URL || 'http://localhost:3001',
        health: '/health',
        version: '1.0.0',
        capabilities: ['employee-management', 'skills-analysis', 'org-hierarchy']
      },
      {
        name: 'matching-engine',
        url: process.env.MATCHING_ENGINE_URL || 'http://localhost:3002',
        health: '/health',
        version: '1.0.0',
        capabilities: ['task-matching', 'analytics', 'recommendations']
      },
      {
        name: 'verification',
        url: process.env.VERIFICATION_SERVICE_URL || 'http://localhost:3003',
        health: '/health',
        version: '1.0.0',
        capabilities: ['certification-verification', 'work-history']
      },
      {
        name: 'edge-agent',
        url: process.env.EDGE_AGENT_URL || 'http://localhost:3004',
        health: '/health',
        version: '1.0.0',
        capabilities: ['distributed-tasks', 'failure-detection', 'state-sync']
      }
    ];

    services.forEach(service => {
      this.services.set(service.name, {
        ...service,
        status: 'unknown',
        lastCheck: new Date()
      });
    });

    logger.info(`Initialized ${services.length} services in registry`);
  }

  private async performHealthChecks() {
    for (const [serviceName, config] of this.services.entries()) {
      try {
        const response = await axios.get(`${config.url}${config.health}`, {
          timeout: 5000
        });
        
        this.services.set(serviceName, {
          ...config,
          status: response.status === 200 ? 'healthy' : 'unhealthy',
          lastCheck: new Date()
        });

        if (config.status !== 'healthy' && response.status === 200) {
          logger.info(`Service ${serviceName} is back online`);
          orchestrationEvents.emit('service_recovered', { serviceName, config });
        }
      } catch (error) {
        this.services.set(serviceName, {
          ...config,
          status: 'unhealthy',
          lastCheck: new Date()
        });

        if (config.status === 'healthy') {
          logger.warn(`Service ${serviceName} health check failed:`, error.message);
          orchestrationEvents.emit('service_failed', { serviceName, config, error });
        }
      }
    }
  }

  getService(name: string): ServiceConfig | undefined {
    return this.services.get(name);
  }

  getHealthyServices(): ServiceConfig[] {
    return Array.from(this.services.values()).filter(s => s.status === 'healthy');
  }

  getAllServices(): ServiceConfig[] {
    return Array.from(this.services.values());
  }

  isServiceHealthy(name: string): boolean {
    const service = this.services.get(name);
    return service?.status === 'healthy';
  }

  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

// Request orchestration and workflow management
class WorkflowOrchestrator {
  private serviceRegistry: ServiceRegistry;

  constructor(serviceRegistry: ServiceRegistry) {
    this.serviceRegistry = serviceRegistry;
  }

  // Complex workflow: Employee onboarding
  async executeEmployeeOnboarding(employeeData: any): Promise<any> {
    const workflowId = uuidv4();
    const results: any = {};

    try {
      logger.info(`Starting employee onboarding workflow: ${workflowId}`);

      // Step 1: Create employee in HR system
      const hrService = this.serviceRegistry.getService('hr-resource');
      if (!hrService || hrService.status !== 'healthy') {
        throw new Error('HR Resource service is not available');
      }

      const employeeResponse = await axios.post(`${hrService.url}/employees`, employeeData);
      results.employee = employeeResponse.data;
      logger.info(`Employee created: ${results.employee.id}`);

      // Step 2: Initialize edge agent state
      const edgeService = this.serviceRegistry.getService('edge-agent');
      if (edgeService && edgeService.status === 'healthy') {
        await axios.post(`${edgeService.url}/agents/initialize`, {
          employeeId: results.employee.id,
          capabilities: employeeData.skills?.map((s: any) => s.name) || []
        });
        results.edgeAgentInitialized = true;
      }

      // Step 3: Generate initial task recommendations
      const matchingService = this.serviceRegistry.getService('matching-engine');
      if (matchingService && matchingService.status === 'healthy') {
        const recommendationsResponse = await axios.get(
          `${matchingService.url}/employees/${results.employee.id}/recommendations`
        );
        results.initialRecommendations = recommendationsResponse.data;
      }

      // Step 4: Cache onboarding result
      await redis.setex(`onboarding:${workflowId}`, 3600, JSON.stringify(results));

      logger.info(`Employee onboarding workflow completed: ${workflowId}`);
      return {
        workflowId,
        status: 'completed',
        results,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error(`Employee onboarding workflow failed: ${workflowId}`, error);
      return {
        workflowId,
        status: 'failed',
        error: error.message,
        partialResults: results,
        timestamp: new Date()
      };
    }
  }

  // Complex workflow: Task assignment and monitoring
  async executeTaskAssignment(taskData: any): Promise<any> {
    const workflowId = uuidv4();
    const results: any = {};

    try {
      logger.info(`Starting task assignment workflow: ${workflowId}`);

      // Step 1: Find optimal matches
      const matchingService = this.serviceRegistry.getService('matching-engine');
      if (!matchingService || matchingService.status !== 'healthy') {
        throw new Error('Matching Engine service is not available');
      }

      // Create task first
      const taskResponse = await axios.post(`${matchingService.url}/tasks`, taskData);
      results.task = taskResponse.data;

      // Find matches
      const matchesResponse = await axios.post(`${matchingService.url}/tasks/${results.task.id}/matches`, {
        maxResults: 5,
        includeRisks: true
      });
      results.matches = matchesResponse.data.matches;

      // Step 2: Auto-assign if high confidence match exists
      const bestMatch = results.matches[0];
      if (bestMatch && bestMatch.score > 85 && bestMatch.confidence > 0.9) {
        const assignResponse = await axios.post(`${matchingService.url}/tasks/${results.task.id}/assign`, {
          employeeId: bestMatch.employeeId,
          reason: 'Auto-assigned based on high confidence match'
        });
        results.assignment = assignResponse.data;

        // Step 3: Initialize distributed task in edge agent
        const edgeService = this.serviceRegistry.getService('edge-agent');
        if (edgeService && edgeService.status === 'healthy') {
          await axios.post(`${edgeService.url}/tasks`, {
            type: 'task_execution',
            payload: {
              taskId: results.task.id,
              employeeId: bestMatch.employeeId,
              estimatedDuration: taskData.estimatedHours
            },
            priority: taskData.priority || 5
          });
          results.distributedTaskCreated = true;
        }
      } else {
        results.assignment = { status: 'pending_manual_review', reason: 'No high confidence match found' };
      }

      await redis.setex(`task_assignment:${workflowId}`, 3600, JSON.stringify(results));

      logger.info(`Task assignment workflow completed: ${workflowId}`);
      return {
        workflowId,
        status: 'completed',
        results,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error(`Task assignment workflow failed: ${workflowId}`, error);
      return {
        workflowId,
        status: 'failed',
        error: error.message,
        partialResults: results,
        timestamp: new Date()
      };
    }
  }

  // Complex workflow: System health monitoring and recovery
  async executeHealthMonitoring(): Promise<any> {
    const workflowId = uuidv4();
    const results: any = {};

    try {
      logger.info(`Starting health monitoring workflow: ${workflowId}`);

      // Step 1: Collect service health data
      const services = this.serviceRegistry.getAllServices();
      results.serviceHealth = services.map(service => ({
        name: service.name,
        status: service.status,
        lastCheck: service.lastCheck,
        capabilities: service.capabilities
      }));

      // Step 2: Check edge agent cluster status
      const edgeService = this.serviceRegistry.getService('edge-agent');
      if (edgeService && edgeService.status === 'healthy') {
        const stateResponse = await axios.get(`${edgeService.url}/state`);
        results.edgeClusterState = {
          totalAgents: Object.keys(stateResponse.data.agentStates).length,
          activeAgents: Object.values(stateResponse.data.agentStates).filter((a: any) => a.status === 'active').length,
          systemMetrics: stateResponse.data.systemMetrics
        };
      }

      // Step 3: Check matching engine performance
      const matchingService = this.serviceRegistry.getService('matching-engine');
      if (matchingService && matchingService.status === 'healthy') {
        const analyticsResponse = await axios.get(`${matchingService.url}/analytics/matching`);
        results.matchingPerformance = analyticsResponse.data;
      }

      // Step 4: Analyze and trigger recovery if needed
      const unhealthyServices = services.filter(s => s.status === 'unhealthy');
      if (unhealthyServices.length > 0) {
        results.recoveryActions = await this.triggerRecoveryActions(unhealthyServices);
      }

      await redis.setex(`health_monitoring:${workflowId}`, 300, JSON.stringify(results));

      return {
        workflowId,
        status: 'completed',
        results,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error(`Health monitoring workflow failed: ${workflowId}`, error);
      return {
        workflowId,
        status: 'failed',
        error: error.message,
        partialResults: results,
        timestamp: new Date()
      };
    }
  }

  private async triggerRecoveryActions(unhealthyServices: ServiceConfig[]): Promise<any[]> {
    const recoveryActions = [];

    for (const service of unhealthyServices) {
      try {
        // Attempt to trigger service recovery through edge agent
        const edgeService = this.serviceRegistry.getService('edge-agent');
        if (edgeService && edgeService.status === 'healthy') {
          await axios.post(`${edgeService.url}/tasks`, {
            type: 'service_recovery',
            payload: {
              serviceName: service.name,
              serviceUrl: service.url
            },
            priority: 1 // High priority
          });

          recoveryActions.push({
            service: service.name,
            action: 'recovery_task_created',
            timestamp: new Date()
          });
        }
      } catch (error) {
        recoveryActions.push({
          service: service.name,
          action: 'recovery_failed',
          error: error.message,
          timestamp: new Date()
        });
      }
    }

    return recoveryActions;
  }
}

// Initialize service registry and orchestrator
const serviceRegistry = new ServiceRegistry();
const orchestrator = new WorkflowOrchestrator(serviceRegistry);

// Request routing middleware
const routeToService = (serviceName: string) => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const service = serviceRegistry.getService(serviceName);
    
    if (!service) {
      return res.status(503).json({ 
        error: `Service ${serviceName} not found`,
        timestamp: new Date()
      });
    }

    if (service.status !== 'healthy') {
      return res.status(503).json({ 
        error: `Service ${serviceName} is currently unavailable`,
        status: service.status,
        lastCheck: service.lastCheck,
        timestamp: new Date()
      });
    }

    req.serviceUrl = service.url;
    next();
  };
};

// Proxy middleware
const proxyToService = async (req: express.Request, res: express.Response) => {
  try {
    const targetUrl = `${req.serviceUrl}${req.path}`;
    const method = req.method.toLowerCase();
    
    const config: any = {
      method,
      url: targetUrl,
      timeout: 30000,
      headers: {
        ...req.headers,
        'x-forwarded-for': req.ip,
        'x-forwarded-proto': req.protocol,
        'x-request-id': uuidv4()
      }
    };

    if (['post', 'put', 'patch'].includes(method)) {
      config.data = req.body;
    }

    if (req.query && Object.keys(req.query).length > 0) {
      config.params = req.query;
    }

    const response = await axios(config);
    res.status(response.status).json(response.data);

  } catch (error: any) {
    logger.error('Proxy error:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ 
        error: 'Service temporarily unavailable',
        timestamp: new Date()
      });
    } else {
      res.status(500).json({ 
        error: 'Internal gateway error',
        timestamp: new Date()
      });
    }
  }
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      serviceUrl?: string;
    }
  }
}

export { serviceRegistry, orchestrator };

// API Routes

// Gateway health and status
app.get('/health', (req, res) => {
  const services = serviceRegistry.getAllServices();
  const healthyCount = services.filter(s => s.status === 'healthy').length;
  
  res.json({
    status: 'healthy',
    gateway: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '1.0.0'
    },
    services: {
      total: services.length,
      healthy: healthyCount,
      unhealthy: services.length - healthyCount,
      details: services
    },
    timestamp: new Date()
  });
});

// Service registry endpoints
app.get('/services', (req, res) => {
  res.json({
    services: serviceRegistry.getAllServices(),
    timestamp: new Date()
  });
});

app.get('/services/:serviceName/health', (req, res) => {
  const service = serviceRegistry.getService(req.params.serviceName);
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }
  res.json(service);
});

// Workflow orchestration endpoints
app.post('/workflows/employee-onboarding', async (req, res) => {
  try {
    const result = await orchestrator.executeEmployeeOnboarding(req.body);
    res.status(result.status === 'completed' ? 201 : 400).json(result);
  } catch (error) {
    logger.error('Employee onboarding workflow error:', error);
    res.status(500).json({ error: 'Workflow execution failed' });
  }
});

app.post('/workflows/task-assignment', async (req, res) => {
  try {
    const result = await orchestrator.executeTaskAssignment(req.body);
    res.status(result.status === 'completed' ? 201 : 400).json(result);
  } catch (error) {
    logger.error('Task assignment workflow error:', error);
    res.status(500).json({ error: 'Workflow execution failed' });
  }
});

app.get('/workflows/health-monitoring', async (req, res) => {
  try {
    const result = await orchestrator.executeHealthMonitoring();
    res.json(result);
  } catch (error) {
    logger.error('Health monitoring workflow error:', error);
    res.status(500).json({ error: 'Workflow execution failed' });
  }
});

// Service proxy routes
app.use('/api/hr/*', routeToService('hr-resource'), proxyToService);
app.use('/api/matching/*', routeToService('matching-engine'), proxyToService);
app.use('/api/verification/*', routeToService('verification'), proxyToService);
app.use('/api/edge/*', routeToService('edge-agent'), proxyToService);

// Analytics and monitoring
app.get('/analytics/overview', async (req, res) => {
  try {
    const services = serviceRegistry.getAllServices();
    const analytics: any = {
      services: {
        total: services.length,
        healthy: services.filter(s => s.status === 'healthy').length,
        unhealthy: services.filter(s => s.status === 'unhealthy').length
      },
      timestamp: new Date()
    };

    // Collect analytics from each service if available
    for (const service of services.filter(s => s.status === 'healthy')) {
      try {
        if (service.name === 'matching-engine') {
          const response = await axios.get(`${service.url}/analytics/matching`, { timeout: 5000 });
          analytics.matching = response.data;
        } else if (service.name === 'edge-agent') {
          const response = await axios.get(`${service.url}/analytics`, { timeout: 5000 });
          analytics.edgeCluster = response.data;
        }
      } catch (error) {
        logger.warn(`Failed to collect analytics from ${service.name}:`, error.message);
      }
    }

    res.json(analytics);
  } catch (error) {
    logger.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Failed to generate analytics overview' });
  }
});

// Real-time WebSocket endpoint for system monitoring
const wsPort = parseInt(process.env.GATEWAY_WS_PORT!) || 3010;

let wss: WebSocket.Server;
try {
  wss = new WebSocket.Server({ 
    port: wsPort,
    perMessageDeflate: false,
    maxPayload: 16 * 1024 * 1024 // 16MB
  });
  
  logger.info(`WebSocket server starting on port ${wsPort}`);
} catch (error) {
  logger.error(`Failed to start WebSocket server on port ${wsPort}:`, error);
  logger.warn('API Gateway will run without WebSocket support');
  wss = null as any;
}

if (wss) {
  wss.on('connection', (ws) => {
    logger.info('New monitoring client connected');
    
    // Send initial system status
    const initialStatus = {
      type: 'system_status',
      data: {
        services: serviceRegistry.getAllServices(),
        timestamp: new Date()
      }
    };
    ws.send(JSON.stringify(initialStatus));

    // Subscribe to service events
    const onServiceEvent = (event: string, data: any) => {
      ws.send(JSON.stringify({
        type: 'service_event',
        event,
        data,
        timestamp: new Date()
      }));
    };

    orchestrationEvents.on('service_failed', (data) => onServiceEvent('service_failed', data));
    orchestrationEvents.on('service_recovered', (data) => onServiceEvent('service_recovered', data));

    ws.on('close', () => {
      logger.info('Monitoring client disconnected');
      orchestrationEvents.removeListener('service_failed', onServiceEvent);
      orchestrationEvents.removeListener('service_recovered', onServiceEvent);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
  });
} else {
  logger.warn('WebSocket server not available - real-time monitoring disabled');
}

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.headers['x-request-id'] || uuidv4(),
    timestamp: new Date()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date()
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down API Gateway...');
  
  serviceRegistry.destroy();
  wss.close();
  await redis.disconnect();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down API Gateway...');
  
  serviceRegistry.destroy();
  wss.close();
  await redis.disconnect();
  
  process.exit(0);
});

// Start server
const PORT = process.env.API_GATEWAY_PORT || 3000;
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`WebSocket monitoring on port ${wsPort}`);
  logger.info('Service discovery and health checking started');
});

export default app;
