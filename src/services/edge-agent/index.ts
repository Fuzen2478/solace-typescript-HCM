import express from 'express';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import dotenv from 'dotenv';
import WebSocket from 'ws';
import cron from 'node-cron';
import os from 'os';
import axios from 'axios';
import { CRDTManager, Employee, Assignment } from './crdt-manager';

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
    new winston.transports.File({ filename: 'edge-agent.log' }),
    new winston.transports.File({ filename: 'edge-agent-error.log', level: 'error' })
  ]
});

// Express app
const app = express();
app.use(express.json());

// Redis client for distributed communication
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT!) || 6379,
  retryDelayOnFailure: 100,
  retryTimes: 3
});

// WebSocket server for real-time communication
const wsPort = parseInt(process.env.EDGE_WS_PORT!) || 3005;
const wss = new WebSocket.Server({ port: wsPort });

// Agent configuration
const AGENT_ID = process.env.AGENT_ID || `edge-agent-${uuidv4().slice(0, 8)}`;
const CLUSTER_NAME = process.env.CLUSTER_NAME || 'hcm-cluster';

// CRDT Manager for distributed state
const crdtManager = new CRDTManager(redis, AGENT_ID, CLUSTER_NAME);

// Interfaces
interface DistributedTask {
  id: string;
  type: 'data_sync' | 'health_check' | 'backup' | 'notification' | 'analytics' | 'cleanup';
  payload: any;
  priority: number; // 1-10 (10 highest)
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  assignedAgent?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

interface AgentState {
  id: string;
  hostname: string;
  status: 'active' | 'inactive' | 'busy' | 'error';
  lastHeartbeat: Date;
  capabilities: string[];
  currentLoad: SystemLoad;
  activeTasks: string[];
  completedTasks: number;
  failedTasks: number;
  uptime: number;
  version: string;
}

interface SystemLoad {
  cpu: number;
  memory: number;
  disk: number;
  networkLatency: number;
  activeConnections: number;
}

interface ClusterState {
  agents: Map<string, AgentState>;
  tasks: Map<string, DistributedTask>;
  lastUpdate: Date;
}

// Task execution engine
class TaskExecutor {
  static async executeTask(task: DistributedTask): Promise<{ success: boolean; result?: any; error?: string }> {
    logger.info(`Executing task ${task.id} of type ${task.type}`);
    
    try {
      let result: any;
      
      switch (task.type) {
        case 'health_check':
          result = await this.executeHealthCheck(task.payload);
          break;
        case 'data_sync':
          result = await this.executeDataSync(task.payload);
          break;
        case 'backup':
          result = await this.executeBackup(task.payload);
          break;
        case 'notification':
          result = await this.executeNotification(task.payload);
          break;
        case 'analytics':
          result = await this.executeAnalytics(task.payload);
          break;
        case 'cleanup':
          result = await this.executeCleanup(task.payload);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      return { success: true, result };
    } catch (error: any) {
      logger.error(`Task ${task.id} failed:`, error);
      return { success: false, error: error.message };
    }
  }
  
  private static async executeHealthCheck(payload: any): Promise<any> {
    const services = payload.services || [
      'http://localhost:3001/health', // HR Service
      'http://localhost:3002/health', // Matching Engine
      'http://localhost:3003/health'  // Verification Service
    ];
    
    const results = [];
    
    for (const serviceUrl of services) {
      try {
        const response = await axios.get(serviceUrl, { timeout: 5000 });
        results.push({
          service: serviceUrl,
          status: 'healthy',
          responseTime: response.headers['response-time'] || 'unknown',
          data: response.data
        });
      } catch (error: any) {
        results.push({
          service: serviceUrl,
          status: 'unhealthy',
          error: error.message
        });
      }
    }
    
    return {
      timestamp: new Date(),
      services: results,
      overallHealth: results.every(r => r.status === 'healthy') ? 'healthy' : 'degraded'
    };
  }
  
  private static async executeDataSync(payload: any): Promise<any> {
    const { sourceService, targetService, dataType, docId } = payload;
    
    logger.info(`Syncing ${dataType} from ${sourceService} to ${targetService}`);
    
    try {
      if (docId) {
        // CRDT-based synchronization
        const doc = crdtManager.getDocument(docId);
        if (!doc) {
          crdtManager.initializeDocument(docId);
          logger.info(`Initialized new CRDT document: ${docId}`);
        }
        
        // Sync with cluster peers
        const agents = await AgentManager.getClusterAgents();
        let syncedPeers = 0;
        
        for (const agent of agents) {
          if (agent.id !== AGENT_ID) {
            const synced = await crdtManager.syncWithPeer(docId, agent.id);
            if (synced) syncedPeers++;
          }
        }
        
        return {
          synced: true,
          docId,
          syncedPeers,
          totalPeers: agents.length - 1,
          timestamp: new Date(),
          crdtData: {
            employees: Object.keys(crdtManager.getEmployees(docId)).length,
            assignments: Object.keys(crdtManager.getAssignments(docId)).length
          }
        };
      } else {
        // Traditional synchronization
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
          synced: true,
          recordsProcessed: Math.floor(Math.random() * 1000) + 100,
          timestamp: new Date()
        };
      }
    } catch (error: any) {
      logger.error('Data sync error:', error);
      throw error;
    }
  }
  
  private static async executeBackup(payload: any): Promise<any> {
    const { databases, destination } = payload;
    
    logger.info(`Starting backup to ${destination}`);
    
    // Simulate backup process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return {
      backupId: uuidv4(),
      databases: databases || ['neo4j', 'redis'],
      destination,
      size: `${Math.floor(Math.random() * 500) + 100}MB`,
      timestamp: new Date()
    };
  }
  
  private static async executeNotification(payload: any): Promise<any> {
    const { type, recipients, message, priority } = payload;
    
    logger.info(`Sending ${type} notification to ${recipients?.length || 0} recipients`);
    
    // In real implementation, this would send actual notifications
    // (email, Slack, SMS, etc.)
    
    return {
      sent: true,
      type,
      recipients: recipients?.length || 0,
      timestamp: new Date()
    };
  }
  
  private static async executeAnalytics(payload: any): Promise<any> {
    const { metrics, timeRange } = payload;
    
    logger.info(`Generating analytics for metrics: ${metrics?.join(', ')}`);
    
    // Simulate analytics processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      metrics: metrics || ['system_performance', 'task_completion', 'service_health'],
      timeRange: timeRange || '24h',
      generatedAt: new Date(),
      reportUrl: `/reports/${uuidv4()}`
    };
  }
  
  private static async executeCleanup(payload: any): Promise<any> {
    const { targets, maxAge } = payload;
    
    logger.info(`Running cleanup for targets: ${targets?.join(', ')}`);
    
    // Simulate cleanup process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      cleaned: true,
      targets: targets || ['temp_files', 'old_logs', 'cache'],
      itemsRemoved: Math.floor(Math.random() * 100) + 10,
      spaceSaved: `${Math.floor(Math.random() * 50) + 5}MB`,
      timestamp: new Date()
    };
  }
}

// Agent management
class AgentManager {
  private static clusterState: ClusterState = {
    agents: new Map(),
    tasks: new Map(),
    lastUpdate: new Date()
  };
  
  static async registerAgent(): Promise<void> {
    const agentState: AgentState = {
      id: AGENT_ID,
      hostname: os.hostname(),
      status: 'active',
      lastHeartbeat: new Date(),
      capabilities: ['task_execution', 'health_monitoring', 'data_sync', 'backup'],
      currentLoad: await this.collectSystemMetrics(),
      activeTasks: [],
      completedTasks: 0,
      failedTasks: 0,
      uptime: process.uptime(),
      version: '1.0.0'
    };
    
    this.clusterState.agents.set(AGENT_ID, agentState);
    
    // Register in Redis for cluster coordination
    await redis.hset(`cluster:${CLUSTER_NAME}:agents`, AGENT_ID, JSON.stringify(agentState));
    
    logger.info(`Agent ${AGENT_ID} registered in cluster ${CLUSTER_NAME}`);
  }
  
  static async updateHeartbeat(): Promise<void> {
    const agent = this.clusterState.agents.get(AGENT_ID);
    if (agent) {
      agent.lastHeartbeat = new Date();
      agent.currentLoad = await this.collectSystemMetrics();
      agent.uptime = process.uptime();
      
      await redis.hset(`cluster:${CLUSTER_NAME}:agents`, AGENT_ID, JSON.stringify(agent));
    }
  }
  
  static async collectSystemMetrics(): Promise<SystemLoad> {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    
    return {
      cpu: Math.min(100, (cpuUsage.user + cpuUsage.system) / 1000000 / 10), // Rough estimate
      memory: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      disk: Math.floor(Math.random() * 30) + 10, // Simulated
      networkLatency: Math.floor(Math.random() * 10) + 1,
      activeConnections: wss.clients.size
    };
  }
  
  static async getClusterAgents(): Promise<AgentState[]> {
    try {
      const agentData = await redis.hgetall(`cluster:${CLUSTER_NAME}:agents`);
      const agents: AgentState[] = [];
      
      for (const [agentId, data] of Object.entries(agentData)) {
        try {
          const agent = JSON.parse(data);
          agent.lastHeartbeat = new Date(agent.lastHeartbeat);
          agents.push(agent);
        } catch (error) {
          logger.warn(`Failed to parse agent data for ${agentId}:`, error);
        }
      }
      
      return agents;
    } catch (error) {
      logger.error('Error getting cluster agents:', error);
      return [];
    }
  }
  
  static async findBestAgent(task: DistributedTask): Promise<string | null> {
    const agents = await this.getClusterAgents();
    const activeAgents = agents.filter(agent => {
      const heartbeatAge = Date.now() - new Date(agent.lastHeartbeat).getTime();
      return agent.status === 'active' && heartbeatAge < 60000; // Active within last minute
    });
    
    if (activeAgents.length === 0) {
      return null;
    }
    
    // Sort by load (CPU + memory) and select least loaded
    activeAgents.sort((a, b) => {
      const loadA = a.currentLoad.cpu + a.currentLoad.memory;
      const loadB = b.currentLoad.cpu + b.currentLoad.memory;
      return loadA - loadB;
    });
    
    return activeAgents[0].id;
  }
}

// Task queue management
class TaskQueue {
  static async addTask(task: DistributedTask): Promise<void> {
    task.createdAt = new Date();
    
    // Find best agent for the task
    const bestAgent = await AgentManager.findBestAgent(task);
    if (bestAgent) {
      task.assignedAgent = bestAgent;
    }
    
    // Store task in Redis
    await redis.hset(`cluster:${CLUSTER_NAME}:tasks`, task.id, JSON.stringify(task));
    
    // Notify assigned agent if different from current
    if (bestAgent && bestAgent !== AGENT_ID) {
      await redis.publish(`agent:${bestAgent}:tasks`, JSON.stringify({
        type: 'task_assigned',
        task
      }));
    } else if (!bestAgent || bestAgent === AGENT_ID) {
      // Execute locally
      this.executeTaskAsync(task);
    }
    
    logger.info(`Task ${task.id} added to queue, assigned to ${bestAgent || 'local'}`);
  }
  
  static async executeTaskAsync(task: DistributedTask): Promise<void> {
    // Execute task asynchronously
    setImmediate(async () => {
      try {
        task.status = 'running';
        task.startedAt = new Date();
        await redis.hset(`cluster:${CLUSTER_NAME}:tasks`, task.id, JSON.stringify(task));
        
        const result = await TaskExecutor.executeTask(task);
        
        task.status = result.success ? 'completed' : 'failed';
        task.completedAt = new Date();
        task.result = result.result;
        task.error = result.error;
        
        await redis.hset(`cluster:${CLUSTER_NAME}:tasks`, task.id, JSON.stringify(task));
        
        // Update agent stats
        const agent = AgentManager['clusterState'].agents.get(AGENT_ID);
        if (agent) {
          if (result.success) {
            agent.completedTasks++;
          } else {
            agent.failedTasks++;
          }
          agent.activeTasks = agent.activeTasks.filter(t => t !== task.id);
        }
        
        logger.info(`Task ${task.id} ${result.success ? 'completed' : 'failed'}`);
        
      } catch (error) {
        logger.error(`Error executing task ${task.id}:`, error);
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : 'Unknown error';
        await redis.hset(`cluster:${CLUSTER_NAME}:tasks`, task.id, JSON.stringify(task));
      }
    });
  }
  
  static async getTasks(status?: string): Promise<DistributedTask[]> {
    try {
      const taskData = await redis.hgetall(`cluster:${CLUSTER_NAME}:tasks`);
      const tasks: DistributedTask[] = [];
      
      for (const [taskId, data] of Object.entries(taskData)) {
        try {
          const task = JSON.parse(data);
          task.createdAt = new Date(task.createdAt);
          task.startedAt = task.startedAt ? new Date(task.startedAt) : undefined;
          task.completedAt = task.completedAt ? new Date(task.completedAt) : undefined;
          
          if (!status || task.status === status) {
            tasks.push(task);
          }
        } catch (error) {
          logger.warn(`Failed to parse task data for ${taskId}:`, error);
        }
      }
      
      return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      logger.error('Error getting tasks:', error);
      return [];
    }
  }
}

// WebSocket handling
wss.on('connection', (ws, req) => {
  const clientId = req.url?.split('?clientId=')[1] || uuidv4();
  logger.info(`WebSocket client connected: ${clientId}`);
  
  // Send current agent status
  ws.send(JSON.stringify({
    type: 'agent_status',
    data: {
      agentId: AGENT_ID,
      status: 'active',
      uptime: process.uptime(),
      timestamp: new Date()
    }
  }));
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      await handleWebSocketMessage(ws, data);
    } catch (error) {
      logger.error('Invalid WebSocket message:', error);
    }
  });
  
  ws.on('close', () => {
    logger.info(`WebSocket client disconnected: ${clientId}`);
  });
  
  ws.on('error', (error) => {
    logger.error(`WebSocket error for client ${clientId}:`, error);
  });
});

const handleWebSocketMessage = async (ws: WebSocket, data: any) => {
  switch (data.type) {
    case 'get_status':
      const agents = await AgentManager.getClusterAgents();
      const tasks = await TaskQueue.getTasks();
      ws.send(JSON.stringify({
        type: 'status_response',
        data: {
          agents,
          tasks: tasks.slice(0, 10), // Last 10 tasks
          clusterName: CLUSTER_NAME,
          timestamp: new Date()
        }
      }));
      break;
      
    case 'submit_task':
      const task: DistributedTask = {
        id: uuidv4(),
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        ...data.payload
      };
      
      await TaskQueue.addTask(task);
      ws.send(JSON.stringify({
        type: 'task_submitted',
        data: { taskId: task.id, status: 'pending' }
      }));
      break;
      
    case 'get_metrics':
      const metrics = await AgentManager.collectSystemMetrics();
      ws.send(JSON.stringify({
        type: 'metrics_response',
        data: {
          agentId: AGENT_ID,
          metrics,
          timestamp: new Date()
        }
      }));
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Unknown message type',
        timestamp: new Date()
      }));
  }
};

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    agentId: AGENT_ID,
    cluster: CLUSTER_NAME,
    timestamp: new Date(),
    services: {
      redis: redis.status,
      websocket: `${wss.clients.size} clients connected`
    },
    version: '1.0.0'
  });
});

// Get agent status
app.get('/status', async (req, res) => {
  try {
    const agents = await AgentManager.getClusterAgents();
    const tasks = await TaskQueue.getTasks();
    const metrics = await AgentManager.collectSystemMetrics();
    
    res.json({
      agentId: AGENT_ID,
      cluster: CLUSTER_NAME,
      agents,
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        running: tasks.filter(t => t.status === 'running').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length,
        recent: tasks.slice(0, 5)
      },
      metrics,
      uptime: process.uptime(),
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error getting status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Submit new task
app.post('/tasks', async (req, res) => {
  try {
    const task: DistributedTask = {
      id: uuidv4(),
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      priority: 5,
      createdAt: new Date(),
      ...req.body
    };
    
    // Validate task
    if (!task.type || !['data_sync', 'health_check', 'backup', 'notification', 'analytics', 'cleanup'].includes(task.type)) {
      return res.status(400).json({ error: 'Invalid task type' });
    }
    
    await TaskQueue.addTask(task);
    
    res.status(201).json({
      taskId: task.id,
      status: 'submitted',
      assignedAgent: task.assignedAgent,
      message: 'Task submitted successfully'
    });
  } catch (error) {
    logger.error('Error submitting task:', error);
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

// Get task status
app.get('/tasks/:taskId', async (req, res) => {
  const { taskId } = req.params;
  
  try {
    const taskData = await redis.hget(`cluster:${CLUSTER_NAME}:tasks`, taskId);
    if (!taskData) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = JSON.parse(taskData);
    task.createdAt = new Date(task.createdAt);
    task.startedAt = task.startedAt ? new Date(task.startedAt) : undefined;
    task.completedAt = task.completedAt ? new Date(task.completedAt) : undefined;
    
    res.json(task);
  } catch (error) {
    logger.error('Error getting task:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// Get all tasks
app.get('/tasks', async (req, res) => {
  const { status, limit = 50 } = req.query;
  
  try {
    const tasks = await TaskQueue.getTasks(status as string);
    res.json({
      tasks: tasks.slice(0, parseInt(limit.toString())),
      total: tasks.length,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error getting tasks:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// Get cluster agents
app.get('/agents', async (req, res) => {
  try {
    const agents = await AgentManager.getClusterAgents();
    res.json({
      agents,
      cluster: CLUSTER_NAME,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error getting agents:', error);
    res.status(500).json({ error: 'Failed to get agents' });
  }
});

// Get system metrics
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await AgentManager.collectSystemMetrics();
    res.json({
      agentId: AGENT_ID,
      metrics,
      uptime: process.uptime(),
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Trigger manual health check
app.post('/health-check', async (req, res) => {
  try {
    const task: DistributedTask = {
      id: uuidv4(),
      type: 'health_check',
      payload: req.body,
      priority: 8,
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
      createdAt: new Date()
    };
    
    await TaskQueue.addTask(task);
    
    res.json({
      taskId: task.id,
      message: 'Health check initiated'
    });
  } catch (error) {
    logger.error('Error triggering health check:', error);
    res.status(500).json({ error: 'Failed to trigger health check' });
  }
});

// Initialize services
const initializeServices = async () => {
  try {
    await redis.ping();
    await AgentManager.registerAgent();
    
    logger.info('All Edge Agent services initialized successfully');
  } catch (error) {
    logger.error('Error initializing services:', error);
    process.exit(1);
  }
};

// Periodic tasks
cron.schedule('*/30 * * * * *', async () => {
  try {
    await AgentManager.updateHeartbeat();
  } catch (error) {
    logger.error('Error updating heartbeat:', error);
  }
});

// Cleanup old tasks every hour
cron.schedule('0 * * * *', async () => {
  try {
    const tasks = await TaskQueue.getTasks();
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    const oldTasks = tasks.filter(task => 
      (task.status === 'completed' || task.status === 'failed') &&
      task.completedAt && task.completedAt.getTime() < cutoffTime
    );
    
    for (const task of oldTasks) {
      await redis.hdel(`cluster:${CLUSTER_NAME}:tasks`, task.id);
    }
    
    if (oldTasks.length > 0) {
      logger.info(`Cleaned up ${oldTasks.length} old tasks`);
    }
  } catch (error) {
    logger.error('Error cleaning up old tasks:', error);
  }
});

// Start server
const PORT = process.env.EDGE_AGENT_PORT || 3004;
app.listen(PORT, async () => {
  logger.info(`Edge Agent Service running on port ${PORT}`);
  logger.info(`Agent ID: ${AGENT_ID}`);
  logger.info(`Cluster: ${CLUSTER_NAME}`);
  logger.info(`WebSocket server running on port ${wsPort}`);
  
  await initializeServices();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down Edge Agent Service...');
  
  // Update agent status to inactive
  const agent = AgentManager['clusterState'].agents.get(AGENT_ID);
  if (agent) {
    agent.status = 'inactive';
    await redis.hset(`cluster:${CLUSTER_NAME}:agents`, AGENT_ID, JSON.stringify(agent));
  }
  
  wss.close();
  await redis.disconnect();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down Edge Agent Service...');
  
  // Update agent status to inactive
  const agent = AgentManager['clusterState'].agents.get(AGENT_ID);
  if (agent) {
    agent.status = 'inactive';
    await redis.hset(`cluster:${CLUSTER_NAME}:agents`, AGENT_ID, JSON.stringify(agent));
  }
  
  wss.close();
  await redis.disconnect();
  
  process.exit(0);
});

export default app;
