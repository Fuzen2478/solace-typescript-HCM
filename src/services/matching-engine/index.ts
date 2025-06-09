import express from 'express';
import neo4j from 'neo4j-driver';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import dotenv from 'dotenv';
import WebSocket from 'ws';
import cron from 'node-cron';

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
    new winston.transports.File({ filename: 'matching-engine.log' }),
    new winston.transports.File({ filename: 'matching-engine-error.log', level: 'error' })
  ]
});

// Express app
const app = express();
app.use(express.json());

// Neo4j Driver with error handling
let neo4jDriver: any = null;

try {
  neo4jDriver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://neo4j:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USER || 'neo4j', 
      process.env.NEO4J_PASSWORD || 'password'
    ),
    {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 30000,
      connectionTimeout: 20000,
      encrypted: false,
      trust: 'TRUST_ALL_CERTIFICATES'
    }
  );
  logger.info('Neo4j driver initialized');
} catch (error) {
  logger.warn('Neo4j driver initialization failed:', error);
  logger.warn('Running in mock mode without Neo4j');
}

// Redis client with error handling
let redis: any = null;

try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT!) || 6379,
    retryDelayOnFailure: 100,
    retryTimes: 3,
    lazyConnect: true,
    connectTimeout: 10000
  });
  
  redis.on('error', (err: any) => {
    logger.error('Redis connection error:', err);
  });
  
  redis.on('connect', () => {
    logger.info('Redis connected successfully');
  });
} catch (error) {
  logger.warn('Redis initialization failed:', error);
  logger.warn('Running without Redis cache');
}

// WebSocket server
const wsPort = parseInt(process.env.MATCHING_WS_PORT!) || 3012;
const wss = new WebSocket.Server({ port: wsPort });

// Interfaces
interface Task {
  id: string;
  title: string;
  description: string;
  requiredSkills: RequiredSkill[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours: number;
  deadline?: Date;
  location?: string;
  remoteAllowed: boolean;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  departmentRestriction?: string;
}

interface RequiredSkill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  mandatory: boolean;
  weight: number;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  skills: Skill[];
  availability: AvailabilityStatus;
  location: string;
  role: string;
  workload: number;
  maxHoursPerWeek: number;
  timezone: string;
  performanceRating: number;
  completionRate: number;
}

interface Skill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  certifiedAt?: Date;
  verifiedBy?: string;
  yearsOfExperience: number;
}

interface AvailabilityStatus {
  available: boolean;
  reason?: string;
  availableFrom?: Date;
  availableUntil?: Date;
  capacity: number;
  scheduledHours: number;
  maxHoursPerWeek: number;
}

interface MatchingResult {
  taskId: string;
  employeeId: string;
  employee: Employee;
  score: number;
  confidence: number;
  reasons: MatchingReason[];
  risks: RiskFactor[];
  estimatedCompletionTime: number;
  recommendedStartDate: Date;
}

interface MatchingReason {
  category: 'skills' | 'availability' | 'workload' | 'location' | 'experience' | 'performance';
  description: string;
  impact: number;
  weight: number;
}

interface RiskFactor {
  type: 'overload' | 'skill_gap' | 'timeline' | 'location' | 'performance';
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation?: string;
}

// Mock matching algorithm for now
class AdvancedMatchingEngine {
  static async findOptimalMatches(task: Task, maxResults: number = 10, session?: any): Promise<MatchingResult[]> {
    if (!neo4jDriver || !session) {
      // Return mock data when Neo4j is not available
      return [{
        taskId: task.id,
        employeeId: 'mock-employee-1',
        employee: {
          id: 'mock-employee-1',
          name: 'Mock Employee',
          email: 'mock@example.com',
          department: 'Engineering',
          skills: [{ name: 'JavaScript', level: 'advanced', yearsOfExperience: 3 }],
          availability: { available: true, capacity: 80, scheduledHours: 20, maxHoursPerWeek: 40 },
          location: 'Remote',
          role: 'Developer',
          workload: 60,
          maxHoursPerWeek: 40,
          timezone: 'UTC',
          performanceRating: 4.5,
          completionRate: 0.95
        } as Employee,
        score: 85,
        confidence: 0.9,
        reasons: [{
          category: 'skills',
          description: 'Strong skill match for required technologies',
          impact: 40,
          weight: 0.4
        }],
        risks: [],
        estimatedCompletionTime: task.estimatedHours,
        recommendedStartDate: new Date()
      }];
    }

    try {
      // Real matching logic - parse JSON strings back to objects
      const result = await session.run(`
        MATCH (e:Employee)
        WHERE e.availability CONTAINS '"available":true'
        AND e.availability CONTAINS '"capacity"'
        RETURN e
        LIMIT $maxResults
      `, { maxResults: neo4j.int(maxResults) });

      return result.records.map((record: any, index: number) => {
        const employeeData = record.get('e').properties;
        
        // Parse JSON strings back to objects
        let availability = { available: true, capacity: 80, scheduledHours: 20, maxHoursPerWeek: 40 };
        let skills: any[] = [];
        
        try {
          if (employeeData.availability && typeof employeeData.availability === 'string') {
            availability = { ...availability, ...JSON.parse(employeeData.availability) };
          }
          if (employeeData.skills && typeof employeeData.skills === 'string') {
            skills = JSON.parse(employeeData.skills);
          }
        } catch (parseError) {
          logger.warn('Error parsing employee data JSON:', parseError);
        }
        
        const employee: Employee = {
          ...employeeData,
          skills,
          availability
        } as Employee;
        
        return {
          taskId: task.id,
          employeeId: employee.id,
          employee,
          score: 80 - (index * 5), // Mock scoring
          confidence: 0.8,
          reasons: [{
            category: 'skills',
            description: 'Available employee',
            impact: 30,
            weight: 0.3
          }],
          risks: [],
          estimatedCompletionTime: task.estimatedHours,
          recommendedStartDate: new Date()
        };
      });
    } catch (error) {
      logger.error('Error in matching algorithm:', error);
      return [];
    }
  }
}

// WebSocket handlers
wss.on('connection', (ws) => {
  logger.info('New WebSocket connection established for matching updates');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      handleWebSocketMessage(ws, data);
    } catch (error) {
      logger.error('Invalid WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket connection closed');
  });
});

const handleWebSocketMessage = (ws: WebSocket, data: any) => {
  switch (data.type) {
    case 'subscribe_matches':
      ws.send(JSON.stringify({ 
        type: 'subscribed', 
        message: 'Subscribed to matching updates',
        timestamp: new Date()
      }));
      break;

    case 'request_match':
      handleRealTimeMatching(ws, data.payload);
      break;

    default:
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Unknown message type',
        timestamp: new Date()
      }));
  }
};

const handleRealTimeMatching = async (ws: WebSocket, task: Task) => {
  if (!neo4jDriver) {
    const mockMatches = await AdvancedMatchingEngine.findOptimalMatches(task, 10);
    ws.send(JSON.stringify({
      type: 'matching_results',
      taskId: task.id,
      matches: mockMatches,
      timestamp: new Date()
    }));
    return;
  }

  const session = neo4jDriver.session();
  try {
    const matches = await AdvancedMatchingEngine.findOptimalMatches(task, 10, session);
    ws.send(JSON.stringify({
      type: 'matching_results',
      taskId: task.id,
      matches,
      timestamp: new Date()
    }));
  } catch (error) {
    logger.error('Error in real-time matching:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to find matches',
      taskId: task.id,
      timestamp: new Date()
    }));
  } finally {
    await session.close();
  }
};

const broadcastUpdate = (type: string, data: any) => {
  const message = JSON.stringify({ type, data, timestamp: new Date() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    services: {
      neo4j: neo4jDriver ? 'connected' : 'not-available',
      redis: redis ? redis.status : 'not-available',
      websocket: `${wss.clients.size} clients connected`
    },
    version: '1.0.0'
  });
});

// Create a new task
app.post('/tasks', async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.title || !req.body.estimatedHours) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, estimatedHours' 
      });
    }

    // Set default values for all fields
    const task: Task = {
      id: uuidv4(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      remoteAllowed: req.body.remoteAllowed || false,
      assignedTo: [],
      ...req.body,
      // Ensure all required fields have values
      description: req.body.description || '',
      requiredSkills: Array.isArray(req.body.requiredSkills) ? req.body.requiredSkills : [],
      priority: req.body.priority || 'medium',
      location: req.body.location || null,
      departmentRestriction: req.body.departmentRestriction || null,
      createdBy: req.body.createdBy || 'system'
    };

    if (!neo4jDriver) {
      // Mock mode
      const matches = await AdvancedMatchingEngine.findOptimalMatches(task, 5);
      return res.status(201).json({
        task,
        initialMatches: matches,
        message: 'Task created in mock mode'
      });
    }

    const session = neo4jDriver.session();
    try {
      // Create task in Neo4j with all required parameters (serialize complex objects)
      await session.run(`
        CREATE (t:Task {
          id: $id,
          title: $title,
          description: $description,
          requiredSkills: $requiredSkills,
          priority: $priority,
          estimatedHours: $estimatedHours,
          deadline: $deadline,
          location: $location,
          remoteAllowed: $remoteAllowed,
          status: $status,
          createdAt: $createdAt,
          updatedAt: $updatedAt,
          createdBy: $createdBy,
          departmentRestriction: $departmentRestriction
        })
      `, {
        ...task,
        deadline: task.deadline ? task.deadline.toISOString() : null,
        requiredSkills: JSON.stringify(task.requiredSkills),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString()
      });

      // Cache task for quick access
      if (redis) {
        await redis.setex(`task:${task.id}`, 3600, JSON.stringify(task));
      }

      // Trigger automatic matching
      const matches = await AdvancedMatchingEngine.findOptimalMatches(task, 5, session);
      
      // Cache matches
      if (redis) {
        await redis.setex(`matches:${task.id}`, 1800, JSON.stringify(matches));
      }

      // Broadcast task creation
      broadcastUpdate('task_created', { task, matches: matches.slice(0, 3) });

      res.status(201).json({
        task,
        initialMatches: matches,
        message: 'Task created and initial matching completed'
      });

    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get matching analytics
app.get('/analytics/matching', async (req, res) => {
  const { timeRange = '7d' } = req.query;
  
  try {
    if (!neo4jDriver) {
      // Return mock analytics
      return res.json({
        timeRange,
        period: { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() },
        totalTasks: 25,
        assignedTasks: 20,
        completedTasks: 15,
        pendingTasks: 5,
        inProgressTasks: 5,
        assignmentRate: 80,
        completionRate: 75,
        mode: 'mock'
      });
    }

    const session = neo4jDriver.session();
    try {
      const endDate = new Date();
      const startDate = new Date();
      switch (timeRange) {
        case '1d': startDate.setDate(endDate.getDate() - 1); break;
        case '7d': startDate.setDate(endDate.getDate() - 7); break;
        case '30d': startDate.setDate(endDate.getDate() - 30); break;
        default: startDate.setDate(endDate.getDate() - 7);
      }

      const stats = await session.run(`
        MATCH (t:Task)
        WHERE t.createdAt >= datetime($startDate) AND t.createdAt <= datetime($endDate)
        RETURN 
          count(t) as totalTasks,
          count(CASE WHEN t.status = 'assigned' THEN 1 END) as assignedTasks,
          count(CASE WHEN t.status = 'completed' THEN 1 END) as completedTasks,
          count(CASE WHEN t.status = 'pending' THEN 1 END) as pendingTasks,
          count(CASE WHEN t.status = 'in_progress' THEN 1 END) as inProgressTasks
      `, { startDate: startDate.toISOString(), endDate: endDate.toISOString() });

      const record = stats.records[0];
      const analytics = {
        timeRange,
        period: { start: startDate, end: endDate },
        totalTasks: record.get('totalTasks').toNumber(),
        assignedTasks: record.get('assignedTasks').toNumber(),
        completedTasks: record.get('completedTasks').toNumber(),
        pendingTasks: record.get('pendingTasks').toNumber(),
        inProgressTasks: record.get('inProgressTasks').toNumber(),
        assignmentRate: 0,
        completionRate: 0
      };

      analytics.assignmentRate = analytics.totalTasks > 0 ? 
        ((analytics.assignedTasks + analytics.inProgressTasks + analytics.completedTasks) / analytics.totalTasks) * 100 : 0;
      analytics.completionRate = analytics.assignedTasks > 0 ? 
        (analytics.completedTasks / analytics.assignedTasks) * 100 : 0;

      res.json(analytics);

    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error('Error getting matching analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Initialize database schema
const initializeDatabase = async () => {
  if (!neo4jDriver) {
    logger.warn('Neo4j driver not available, skipping database initialization');
    return;
  }
  
  const session = neo4jDriver.session();
  try {
    await session.run('CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE');
    await session.run('CREATE INDEX task_status IF NOT EXISTS FOR (t:Task) ON (t.status)');
    await session.run('CREATE INDEX task_priority IF NOT EXISTS FOR (t:Task) ON (t.priority)');
    await session.run('CREATE INDEX task_created IF NOT EXISTS FOR (t:Task) ON (t.createdAt)');
    
    logger.info('Matching Engine database schema initialized successfully');
  } catch (error) {
    logger.error('Error initializing database schema:', error);
  } finally {
    await session.close();
  }
};

// Initialize services
const initializeServices = async () => {
  try {
    if (neo4jDriver) {
      const session = neo4jDriver.session();
      await session.run('RETURN 1');
      await session.close();
      logger.info('Neo4j connection verified');
    }
    
    if (redis) {
      await redis.ping();
      logger.info('Redis connection verified');
    }
    
    await initializeDatabase();
    
    logger.info('All Matching Engine services initialized successfully');
  } catch (error) {
    logger.warn('Some services failed to initialize, running in degraded mode:', error);
  }
};

// Start server
const PORT = process.env.MATCHING_ENGINE_PORT || 3002;
app.listen(PORT, async () => {
  logger.info(`Matching Engine Service running on port ${PORT}`);
  logger.info(`WebSocket server running on port ${wsPort}`);
  
  await initializeServices();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down Matching Engine Service...');
  wss.close();
  if (redis) await redis.disconnect();
  if (neo4jDriver) await neo4jDriver.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down Matching Engine Service...');
  wss.close();
  if (redis) await redis.disconnect();
  if (neo4jDriver) await neo4jDriver.close();
  process.exit(0);
});

export default app;