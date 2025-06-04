import express from 'express';
import neo4j from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import dotenv from 'dotenv';
import solace from 'solclientjs';

dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'matching-engine.log' })
  ]
});

// Express app
const app = express();
app.use(express.json());

// Neo4j Driver
const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
);

// Solace Setup
const factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10;
solace.SolclientFactory.init(factoryProps);

let solaceSession: solace.Session | null = null;

// Interfaces
interface Task {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours: number;
  deadline: Date;
  location?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  assignedTo?: string;
}

interface MatchingResult {
  taskId: string;
  employeeId: string;
  score: number;
  reasons: string[];
}

// Connect to Solace
function connectToSolace() {
  try {
    solaceSession = solace.SolclientFactory.createSession({
      url: process.env.SOLACE_URL!,
      vpnName: process.env.SOLACE_VPN!,
      userName: process.env.SOLACE_USERNAME!,
      password: process.env.SOLACE_PASSWORD!
    });

    solaceSession.on(solace.SessionEventCode.UP_NOTICE, () => {
      logger.info('Connected to Solace message broker');
      subscribeToTopics();
    });

    solaceSession.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (error: any) => {
      logger.error('Failed to connect to Solace:', error);
    });

    solaceSession.connect();
  } catch (error) {
    logger.error('Error connecting to Solace:', error);
  }
}

// Subscribe to Solace topics
function subscribeToTopics() {
  if (!solaceSession) return;

  const topics = [
    'hcm/task/created',
    'hcm/employee/updated',
    'hcm/employee/availability'
  ];

  topics.forEach(topic => {
    solaceSession!.subscribe(
      solace.SolclientFactory.createTopicDestination(topic),
      true,
      topic,
      10000
    );
  });

  solaceSession.on(solace.SessionEventCode.MESSAGE, handleSolaceMessage);
}

// Handle Solace messages
function handleSolaceMessage(message: solace.Message) {
  const topic = message.getDestination().getName();
  const payload = JSON.parse(message.getBinaryAttachment() as string);

  logger.info(`Received message on topic ${topic}:`, payload);

  switch (topic) {
    case 'hcm/task/created':
      handleNewTask(payload);
      break;
    case 'hcm/employee/updated':
      recalculateMatches(payload.employeeId);
      break;
    case 'hcm/employee/availability':
      handleAvailabilityChange(payload);
      break;
  }
}

// Publish to Solace
function publishToSolace(topic: string, data: any) {
  if (!solaceSession) return;

  const message = solace.SolclientFactory.createMessage();
  message.setDestination(solace.SolclientFactory.createTopicDestination(topic));
  message.setBinaryAttachment(JSON.stringify(data));
  message.setDeliveryMode(solace.MessageDeliveryModeType.PERSISTENT);

  try {
    solaceSession.send(message);
    logger.info(`Published message to topic ${topic}`);
  } catch (error) {
    logger.error(`Error publishing to topic ${topic}:`, error);
  }
}

// Matching algorithm
async function findBestMatchesForTask(task: Task): Promise<MatchingResult[]> {
  const session = neo4jDriver.session();
  try {
    // Find employees with matching skills
    const result = await session.run(`
      MATCH (e:Employee)
      WHERE e.availability = true
      AND any(skill IN $requiredSkills WHERE skill IN e.skills)
      RETURN e, 
        size([skill IN $requiredSkills WHERE skill IN e.skills]) as matchingSkills,
        e.location = $location as sameLocation
      ORDER BY matchingSkills DESC, sameLocation DESC
      LIMIT 10
    `, {
      requiredSkills: task.requiredSkills,
      location: task.location || ''
    });

    const matches: MatchingResult[] = [];

    for (const record of result.records) {
      const employee = record.get('e').properties;
      const matchingSkills = record.get('matchingSkills');
      const sameLocation = record.get('sameLocation');

      // Calculate matching score
      let score = 0;
      const reasons: string[] = [];

      // Skill match (40 points max)
      const skillScore = (matchingSkills / task.requiredSkills.length) * 40;
      score += skillScore;
      reasons.push(`Matches ${matchingSkills}/${task.requiredSkills.length} required skills`);

      // Location match (20 points)
      if (sameLocation && task.location) {
        score += 20;
        reasons.push('Same location as task');
      }

      // Check workload (20 points)
      const workloadResult = await session.run(`
        MATCH (e:Employee {id: $employeeId})-[:ASSIGNED_TO]->(t:Task)
        WHERE t.status IN ['assigned', 'in_progress']
        RETURN count(t) as currentTasks
      `, { employeeId: employee.id });

      const currentTasks = workloadResult.records[0]?.get('currentTasks') || 0;
      if (currentTasks < 3) {
        const workloadScore = 20 - (currentTasks * 5);
        score += workloadScore;
        reasons.push(`Low workload (${currentTasks} current tasks)`);
      }

      // Department match (20 points)
      if (task.requiredSkills.some(skill => skill.includes(employee.department))) {
        score += 20;
        reasons.push('Department expertise matches task requirements');
      }

      matches.push({
        taskId: task.id,
        employeeId: employee.id,
        score,
        reasons
      });
    }

    return matches.sort((a, b) => b.score - a.score);
  } finally {
    await session.close();
  }
}

// Handle new task
async function handleNewTask(task: Task) {
  const matches = await findBestMatchesForTask(task);
  
  if (matches.length > 0) {
    const bestMatch = matches[0];
    
    // Auto-assign if score is high enough
    if (bestMatch.score >= 70) {
      await assignTaskToEmployee(task.id, bestMatch.employeeId);
      
      publishToSolace('hcm/task/assigned', {
        taskId: task.id,
        employeeId: bestMatch.employeeId,
        score: bestMatch.score,
        reasons: bestMatch.reasons
      });
    } else {
      // Send recommendations for manual review
      publishToSolace('hcm/task/recommendations', {
        taskId: task.id,
        recommendations: matches.slice(0, 3)
      });
    }
  } else {
    // No suitable matches found
    publishToSolace('hcm/task/no-matches', {
      taskId: task.id,
      message: 'No suitable employees found for this task'
    });
  }
}

// Assign task to employee
async function assignTaskToEmployee(taskId: string, employeeId: string) {
  const session = neo4jDriver.session();
  try {
    await session.run(`
      MATCH (t:Task {id: $taskId}), (e:Employee {id: $employeeId})
      CREATE (e)-[:ASSIGNED_TO]->(t)
      SET t.status = 'assigned', t.assignedTo = $employeeId
    `, { taskId, employeeId });

    logger.info(`Task ${taskId} assigned to employee ${employeeId}`);
  } finally {
    await session.close();
  }
}

// Recalculate matches when employee data changes
async function recalculateMatches(employeeId: string) {
  const session = neo4jDriver.session();
  try {
    // Find unassigned tasks that might match this employee
    const result = await session.run(`
      MATCH (t:Task)
      WHERE t.status = 'pending'
      RETURN t
    `);

    for (const record of result.records) {
      const task = record.get('t').properties;
      await handleNewTask(task);
    }
  } finally {
    await session.close();
  }
}

// Handle availability change
async function handleAvailabilityChange(data: { employeeId: string, available: boolean }) {
  if (data.available) {
    // Employee became available, recalculate matches
    await recalculateMatches(data.employeeId);
  } else {
    // Employee became unavailable, reassign their pending tasks
    const session = neo4jDriver.session();
    try {
      const result = await session.run(`
        MATCH (e:Employee {id: $employeeId})-[:ASSIGNED_TO]->(t:Task)
        WHERE t.status = 'assigned'
        RETURN t
      `, { employeeId: data.employeeId });

      for (const record of result.records) {
        const task = record.get('t').properties;
        
        // Remove assignment
        await session.run(`
          MATCH (e:Employee {id: $employeeId})-[r:ASSIGNED_TO]->(t:Task {id: $taskId})
          DELETE r
          SET t.status = 'pending', t.assignedTo = null
        `, { employeeId: data.employeeId, taskId: task.id });

        // Find new match
        await handleNewTask(task);
      }
    } finally {
      await session.close();
    }
  }
}

// API Routes

// Create a new task
app.post('/tasks', async (req, res) => {
  const task: Task = {
    id: uuidv4(),
    status: 'pending',
    ...req.body
  };

  const session = neo4jDriver.session();
  try {
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
        status: $status
      })
    `, task);

    // Trigger matching process
    await handleNewTask(task);

    res.status(201).json(task);
  } catch (error) {
    logger.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  } finally {
    await session.close();
  }
});

// Get task recommendations
app.get('/tasks/:taskId/recommendations', async (req, res) => {
  const { taskId } = req.params;
  
  const session = neo4jDriver.session();
  try {
    const taskResult = await session.run(
      'MATCH (t:Task {id: $taskId}) RETURN t',
      { taskId }
    );

    if (taskResult.records.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.records[0].get('t').properties;
    const matches = await findBestMatchesForTask(task);

    res.json(matches);
  } catch (error) {
    logger.error('Error getting recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  } finally {
    await session.close();
  }
});

// Manually assign task
app.post('/tasks/:taskId/assign', async (req, res) => {
  const { taskId } = req.params;
  const { employeeId } = req.body;

  try {
    await assignTaskToEmployee(taskId, employeeId);
    
    publishToSolace('hcm/task/assigned', {
      taskId,
      employeeId,
      manual: true
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error assigning task:', error);
    res.status(500).json({ error: 'Failed to assign task' });
  }
});

// Get matching statistics
app.get('/stats', async (req, res) => {
  const session = neo4jDriver.session();
  try {
    const stats = await session.run(`
      MATCH (t:Task)
      RETURN 
        count(CASE WHEN t.status = 'pending' THEN 1 END) as pendingTasks,
        count(CASE WHEN t.status = 'assigned' THEN 1 END) as assignedTasks,
        count(CASE WHEN t.status = 'in_progress' THEN 1 END) as inProgressTasks,
        count(CASE WHEN t.status = 'completed' THEN 1 END) as completedTasks
    `);

    const record = stats.records[0];
    res.json({
      pendingTasks: record.get('pendingTasks').toNumber(),
      assignedTasks: record.get('assignedTasks').toNumber(),
      inProgressTasks: record.get('inProgressTasks').toNumber(),
      completedTasks: record.get('completedTasks').toNumber()
    });
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  } finally {
    await session.close();
  }
});

// Start server
const PORT = process.env.MATCHING_ENGINE_PORT || 3002;
app.listen(PORT, () => {
  logger.info(`Matching Engine Service running on port ${PORT}`);
  connectToSolace();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (solaceSession) {
    solaceSession.disconnect();
  }
  await neo4jDriver.close();
  process.exit(0);
});

export default app;
