import { app, neo4jDriver, redis, wss, logger, Task, Employee, MatchingResult } from './index';
import { AdvancedMatchingEngine } from './matching-algorithm';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import cron from 'node-cron';

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
      neo4j: 'connected',
      redis: redis.status,
      websocket: `${wss.clients.size} clients connected`
    },
    version: '1.0.0'
  });
});

// Create a new task
app.post('/tasks', async (req, res) => {
  try {
    const task: Task = {
      id: uuidv4(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      remoteAllowed: false,
      assignedTo: [],
      ...req.body
    };

    // Validate required fields
    if (!task.title || !task.requiredSkills || !task.estimatedHours) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, requiredSkills, estimatedHours' 
      });
    }

    const session = neo4jDriver.session();
    try {
      // Create task in Neo4j
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
        requiredSkills: JSON.stringify(task.requiredSkills)
      });

      // Cache task for quick access
      await redis.setex(`task:${task.id}`, 3600, JSON.stringify(task));

      // Trigger automatic matching
      const matches = await AdvancedMatchingEngine.findOptimalMatches(task, 5, session);
      
      // Cache matches
      await redis.setex(`matches:${task.id}`, 1800, JSON.stringify(matches));

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

// Find matches for a task
app.post('/tasks/:taskId/matches', async (req, res) => {
  const { taskId } = req.params;
  const { maxResults = 10, includeRisks = true, forceRefresh = false } = req.body;

  try {
    // Check cache first unless forced refresh
    if (!forceRefresh) {
      const cached = await redis.get(`matches:${taskId}`);
      if (cached) {
        const matches = JSON.parse(cached);
        return res.json({
          taskId,
          matches: includeRisks ? matches : matches.map((m: MatchingResult) => ({ ...m, risks: undefined })),
          timestamp: new Date(),
          cached: true
        });
      }
    }

    const session = neo4jDriver.session();
    try {
      const taskResult = await session.run('MATCH (t:Task {id: $taskId}) RETURN t', { taskId });
      
      if (taskResult.records.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const taskData = taskResult.records[0].get('t').properties;
      const task: Task = {
        ...taskData,
        requiredSkills: JSON.parse(taskData.requiredSkills || '[]'),
        deadline: taskData.deadline ? new Date(taskData.deadline) : undefined,
        createdAt: new Date(taskData.createdAt),
        updatedAt: new Date(taskData.updatedAt)
      };

      const matches = await AdvancedMatchingEngine.findOptimalMatches(task, maxResults, session);

      // Cache results for 30 minutes
      await redis.setex(`matches:${taskId}`, 1800, JSON.stringify(matches));
      
      // Broadcast update to connected clients
      broadcastUpdate('new_matches', { taskId, matches: matches.slice(0, 3) });

      res.json({
        taskId,
        matches: includeRisks ? matches : matches.map(m => ({ ...m, risks: undefined })),
        timestamp: new Date(),
        cached: false
      });

    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error('Error finding matches:', error);
    res.status(500).json({ error: 'Failed to find matches' });
  }
});

// Assign task to employee(s)
app.post('/tasks/:taskId/assign', async (req, res) => {
  const { taskId } = req.params;
  const { employeeId, employeeIds, reason, overrideRisks = false } = req.body;

  const session = neo4jDriver.session();
  try {
    // Support both single and multiple assignments
    const assignees = employeeIds || [employeeId];
    if (!assignees || assignees.length === 0) {
      return res.status(400).json({ error: 'Employee ID(s) required' });
    }

    // Check for risks in cached matches if not overriding
    if (!overrideRisks) {
      const cached = await redis.get(`matches:${taskId}`);
      if (cached) {
        const matches = JSON.parse(cached);
        for (const assigneeId of assignees) {
          const selectedMatch = matches.find((m: MatchingResult) => m.employeeId === assigneeId);
          
          if (selectedMatch && selectedMatch.risks.length > 0 && selectedMatch.confidence < 0.7) {
            return res.status(400).json({
              error: 'Assignment has high risks',
              employeeId: assigneeId,
              risks: selectedMatch.risks,
              confidence: selectedMatch.confidence,
              message: 'Use overrideRisks=true to force assignment'
            });
          }
        }
      }
    }

    // Create assignments
    for (const assigneeId of assignees) {
      await session.run(`
        MATCH (t:Task {id: $taskId}), (e:Employee {id: $employeeId})
        CREATE (e)-[a:ASSIGNED_TO {
          assignedAt: datetime(),
          assignedBy: $assignedBy,
          reason: $reason
        }]->(t)
        SET t.status = 'assigned', 
            t.assignedTo = CASE 
              WHEN t.assignedTo IS NULL THEN [$employeeId]
              ELSE t.assignedTo + $employeeId
            END,
            t.updatedAt = datetime()
      `, { 
        taskId, 
        employeeId: assigneeId, 
        assignedBy: req.body.assignedBy || 'system',
        reason: reason || 'Automatic assignment based on matching score'
      });

      // Update employee workload
      await session.run(`
        MATCH (e:Employee {id: $employeeId})-[:ASSIGNED_TO]->(t:Task)
        WHERE t.status IN ['assigned', 'in_progress']
        WITH e, sum(t.estimatedHours) as totalHours
        SET e.workload = CASE
          WHEN e.maxHoursPerWeek > 0
          THEN (totalHours / e.maxHoursPerWeek) * 100
          ELSE (totalHours / 40) * 100
        END
      `, { employeeId: assigneeId });
    }

    // Clear cached matches
    await redis.del(`matches:${taskId}`);
    
    // Broadcast assignment
    broadcastUpdate('task_assigned', { 
      taskId, 
      assignees, 
      timestamp: new Date() 
    });

    res.json({ 
      success: true, 
      taskId, 
      assignees, 
      message: `Task assigned successfully to ${assignees.length} employee(s)` 
    });

  } catch (error) {
    logger.error('Error assigning task:', error);
    res.status(500).json({ error: 'Failed to assign task' });
  } finally {
    await session.close();
  }
});

// Get matching analytics
app.get('/analytics/matching', async (req, res) => {
  const { timeRange = '7d' } = req.query;
  
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

  } catch (error) {
    logger.error('Error getting matching analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  } finally {
    await session.close();
  }
});

// Initialize database schema
const initializeDatabase = async () => {
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
    const session = neo4jDriver.session();
    await session.run('RETURN 1');
    await session.close();
    
    await redis.ping();
    await initializeDatabase();
    
    logger.info('All Matching Engine services initialized successfully');
  } catch (error) {
    logger.error('Error initializing services:', error);
    process.exit(1);
  }
};

// Periodic workload recalculation
cron.schedule('0 * * * *', async () => {
  logger.info('Starting periodic workload recalculation');
  
  const session = neo4jDriver.session();
  try {
    await session.run(`
      MATCH (e:Employee)
      OPTIONAL MATCH (e)-[:ASSIGNED_TO]->(t:Task)
      WHERE t.status IN ['assigned', 'in_progress']
      WITH e, sum(t.estimatedHours) as totalHours
      SET e.workload = CASE 
        WHEN e.maxHoursPerWeek > 0 
        THEN (totalHours / e.maxHoursPerWeek) * 100
        ELSE (totalHours / 40) * 100
      END
    `);
    
    logger.info('Workload recalculation completed');
  } catch (error) {
    logger.error('Error in workload recalculation:', error);
  } finally {
    await session.close();
  }
});

// Start server
const PORT = process.env.MATCHING_ENGINE_PORT || 3002;
app.listen(PORT, async () => {
  logger.info(`Matching Engine Service running on port ${PORT}`);
  logger.info(`WebSocket server running on port ${parseInt(process.env.MATCHING_WS_PORT!) || 3003}`);
  
  await initializeServices();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down Matching Engine Service...');
  wss.close();
  await redis.disconnect();
  await neo4jDriver.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down Matching Engine Service...');
  wss.close();
  await redis.disconnect();
  await neo4jDriver.close();
  process.exit(0);
});

export default app;
