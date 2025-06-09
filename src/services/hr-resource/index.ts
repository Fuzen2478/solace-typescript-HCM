import express from 'express';
import ldap from 'ldapjs';
import neo4j from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import dotenv from 'dotenv';
import cron from 'node-cron';
import WebSocket from 'ws';
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
    new winston.transports.File({ filename: 'hr-resource.log' }),
    new winston.transports.File({ filename: 'hr-resource-error.log', level: 'error' })
  ]
});

// Event emitter for real-time updates
const hrEventEmitter = new EventEmitter();

// Express app
const app = express();
app.use(express.json());

// LDAP Client setup with Mock support
let ldapClient: any;

const createLdapClient = () => {
  if (process.env.MOCK_LDAP_ENABLED === 'true' || process.env.NODE_ENV === 'development') {
    // Mock LDAP client for local development
    ldapClient = {
      bind: (dn: string, password: string, callback: Function) => {
        logger.info('Mock LDAP bind successful');
        callback(null);
      },
      add: (dn: string, entry: any, callback: Function) => {
        logger.info(`Mock LDAP add: ${dn}`);
        callback(null);
      },
      search: (base: string, options: any, callback: Function) => {
        logger.info(`Mock LDAP search: ${base}`);
        callback(null, { entries: [] });
      },
      unbind: () => {
        logger.info('Mock LDAP unbind');
      }
    };
    logger.info('Using Mock LDAP client for local development');
  } else {
    // Real LDAP client
    ldapClient = ldap.createClient({
      url: process.env.LDAP_URL!,
      reconnect: true
    });

    ldapClient.on('error', (err: any) => {
      logger.error('LDAP client error:', err);
      setTimeout(createLdapClient, 5000);
    });

    ldapClient.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_PASSWORD!, (err: any) => {
      if (err) {
        logger.error('LDAP bind failed:', err);
        setTimeout(createLdapClient, 5000);
      } else {
        logger.info('LDAP bind successful');
      }
    });
  }
};

// Initialize LDAP client
createLdapClient();

// Neo4j Driver with connection pool and error handling
let neo4jDriver: any = null;

try {
  neo4jDriver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USER || 'neo4j', 
      process.env.NEO4J_PASSWORD || 'password'
    ),
    {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 30000,
      connectionTimeout: 20000,
      encrypted: false,  // 암호화 비활성화
      trust: 'TRUST_ALL_CERTIFICATES'  // 모든 인증서 신뢰
    }
  );
  logger.info('Neo4j driver initialized');
} catch (error) {
  logger.warn('Neo4j driver initialization failed:', error);
  logger.warn('Running in mock mode without Neo4j');
}

// Enhanced interfaces
interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  skills: Skill[];
  availability: AvailabilityStatus;
  location: string;
  role: string;
  certifications: Certification[];
  workload: number; // 0-100 percentage
  timezone: string;
  contactInfo: ContactInfo;
  emergencyContact: EmergencyContact;
  manager?: string; // Manager ID
  directReports: string[]; // Employee IDs
  createdAt: Date;
  updatedAt: Date;
}

interface Skill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  certifiedAt?: Date;
  verifiedBy?: string;
}

interface Certification {
  id: string;
  name: string;
  issuer: string;
  issuedAt: Date;
  expiresAt?: Date;
  blockchainHash?: string; // For blockchain verification
  verified: boolean;
}

interface AvailabilityStatus {
  available: boolean;
  reason?: string;
  availableFrom?: Date;
  availableUntil?: Date;
  capacity: number; // 0-100 percentage
}

interface ContactInfo {
  phone: string;
  address: string;
  linkedIn?: string;
  slack?: string;
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

interface ResourceRequest {
  id: string;
  requesterId: string;
  requiredSkills: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: number; // hours
  startTime: Date;
  endTime: Date;
  location?: string;
  remote: boolean;
  description: string;
  status: 'pending' | 'approved' | 'assigned' | 'completed' | 'cancelled';
  assignedEmployees: string[];
  createdAt: Date;
}

interface WorkloadAssignment {
  employeeId: string;
  taskId: string;
  allocation: number; // percentage of time
  startDate: Date;
  endDate: Date;
  priority: number;
}

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ port: parseInt(process.env.WS_PORT!) || 3011 });

wss.on('connection', (ws) => {
  logger.info('New WebSocket connection established');
  
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
    case 'subscribe':
      // Subscribe to specific events
      ws.send(JSON.stringify({ type: 'subscribed', topics: data.topics }));
      break;
    case 'employee_update':
      // Handle real-time employee updates
      hrEventEmitter.emit('employee_updated', data.payload);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
};

// Broadcast to all connected clients
const broadcastUpdate = (type: string, data: any) => {
  const message = JSON.stringify({ type, data, timestamp: new Date() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

// Initialize database schema
const initializeDatabase = async () => {
  if (!neo4jDriver) {
    logger.warn('Neo4j driver not available, skipping database initialization');
    return;
  }
  
  const session = neo4jDriver.session();
  try {
    // Test connection first with timeout
    const testResult = await Promise.race([
      session.run('RETURN 1'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      )
    ]);
    
    // Create constraints and indexes
    await session.run('CREATE CONSTRAINT employee_id IF NOT EXISTS FOR (e:Employee) REQUIRE e.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT cert_id IF NOT EXISTS FOR (c:Certification) REQUIRE c.id IS UNIQUE');
    await session.run('CREATE INDEX employee_email IF NOT EXISTS FOR (e:Employee) ON (e.email)');
    await session.run('CREATE INDEX employee_department IF NOT EXISTS FOR (e:Employee) ON (e.department)');
    await session.run('CREATE INDEX employee_skills IF NOT EXISTS FOR (e:Employee) ON (e.skills)');
    
    logger.info('Database schema initialized successfully');
  } catch (error) {
    logger.error('Error initializing database schema:', error);
    logger.warn('Database operations will use mock mode');
    
    // Disable Neo4j driver for subsequent operations
    neo4jDriver = null;
  } finally {
    await session.close();
  }
};

// Advanced matching engine
class ResourceMatchingEngine {
  static async findOptimalMatch(request: ResourceRequest): Promise<Employee[]> {
    const session = neo4jDriver.session();
    try {
      // Complex matching algorithm considering skills, availability, workload, and location
      const query = `
        MATCH (e:Employee)
        WHERE e.availability.available = true
        AND e.availability.capacity > 20
        AND any(skill IN $requiredSkills WHERE skill IN [s IN e.skills | s.name])
        AND (
          ($remote = true) OR 
          ($location IS NULL) OR 
          (e.location = $location)
        )
        WITH e, 
             size([skill IN $requiredSkills WHERE skill IN [s IN e.skills | s.name]]) as skillMatch,
             (100 - e.workload) as availableCapacity
        ORDER BY skillMatch DESC, availableCapacity DESC, e.updatedAt ASC
        LIMIT 10
        RETURN e, skillMatch, availableCapacity
      `;

      const result = await session.run(query, {
        requiredSkills: request.requiredSkills,
        remote: request.remote,
        location: request.location
      });

      const candidates = result.records.map((record: any) => ({
        employee: record.get('e').properties as Employee,
        skillMatch: record.get('skillMatch').toNumber(),
        availableCapacity: record.get('availableCapacity').toNumber()
      }));

      // Apply additional filters and scoring
      const scoredCandidates = candidates.map((candidate: any) => ({
        ...candidate,
        score: this.calculateMatchScore(candidate, request)
      })).sort((a: any, b: any) => b.score - a.score);

      return scoredCandidates.slice(0, 5).map((c: any) => c.employee);
    } finally {
      await session.close();
    }
  }

  private static calculateMatchScore(candidate: any, request: ResourceRequest): number {
    let score = 0;
    
    // Skill match weight: 40%
    score += (candidate.skillMatch / request.requiredSkills.length) * 40;
    
    // Availability weight: 30%
    score += (candidate.availableCapacity / 100) * 30;
    
    // Priority adjustment: 20%
    const priorityMultiplier = {
      'low': 0.8,
      'medium': 1.0,
      'high': 1.2,
      'critical': 1.5
    };
    score *= priorityMultiplier[request.priority];
    
    // Location preference: 10%
    if (request.remote || !request.location) {
      score += 10;
    }
    
    return score;
  }
}

// Workload management
class WorkloadManager {
  static async updateEmployeeWorkload(employeeId: string): Promise<number> {
    const session = neo4jDriver.session();
    try {
      // Calculate current workload based on active assignments
      const result = await session.run(`
        MATCH (e:Employee {id: $employeeId})
        OPTIONAL MATCH (e)-[:ASSIGNED_TO]->(t:Task)
        WHERE t.status IN ['active', 'pending']
        WITH e, sum(t.allocation) as totalAllocation
        SET e.workload = coalesce(totalAllocation, 0)
        RETURN e.workload as workload
      `, { employeeId });

      const workload = result.records[0]?.get('workload')?.toNumber() || 0;
      
      // Emit workload update event
      hrEventEmitter.emit('workload_updated', { employeeId, workload });
      broadcastUpdate('workload_update', { employeeId, workload });
      
      return workload;
    } finally {
      await session.close();
    }
  }

  static async getTeamWorkload(departmentOrManager: string): Promise<any[]> {
    const session = neo4jDriver.session();
    try {
      const result = await session.run(`
        MATCH (e:Employee)
        WHERE e.department = $dept OR e.manager = $manager
        RETURN e.id as employeeId, e.name as name, e.workload as workload, e.availability as availability
        ORDER BY e.workload DESC
      `, { dept: departmentOrManager, manager: departmentOrManager });

      return result.records.map((record: any) => ({
        employeeId: record.get('employeeId'),
        name: record.get('name'),
        workload: record.get('workload'),
        availability: record.get('availability')
      }));
    } finally {
      await session.close();
    }
  }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date(),
    services: {
      ldap: ldapClient ? 'mock-enabled' : 'disconnected',
      neo4j: neo4jDriver ? 'driver-ready' : 'not-available',
      websocket: `${wss.clients.size} clients connected`
    },
    mode: 'development'
  });
});

// Get all employees with advanced filtering
app.get('/employees', async (req, res) => {
  const { 
    department, 
    skill, 
    available, 
    location, 
    role,
    limit = 50,
    offset = 0,
    sortBy = 'name',
    sortOrder = 'ASC'
  } = req.query;

  const session = neo4jDriver.session();
  try {
    let whereClause = '';
    const params: any = { 
      limit: neo4j.int(parseInt(limit.toString())), 
      offset: neo4j.int(parseInt(offset.toString())) 
    };

    const conditions = [];
    if (department) {
      conditions.push('e.department = $department');
      params.department = department;
    }
    if (skill) {
      conditions.push('$skill IN [s IN e.skills | s.name]');
      params.skill = skill;
    }
    if (available !== undefined) {
      conditions.push('e.availability.available = $available');
      params.available = available === 'true';
    }
    if (location) {
      conditions.push('e.location = $location');
      params.location = location;
    }
    if (role) {
      conditions.push('e.role = $role');
      params.role = role;
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const query = `
      MATCH (e:Employee) 
      ${whereClause}
      RETURN e 
      ORDER BY e.${sortBy} ${sortOrder}
      SKIP $offset LIMIT $limit
    `;

    const result = await session.run(query, params);
    const employees = result.records.map((record: any) => {
      const employeeData = record.get('e').properties;
      
      // Parse JSON strings back to objects
      let parsedEmployee = { ...employeeData };
      
      try {
        if (employeeData.skills && typeof employeeData.skills === 'string') {
          parsedEmployee.skills = JSON.parse(employeeData.skills);
        }
        if (employeeData.availability && typeof employeeData.availability === 'string') {
          parsedEmployee.availability = JSON.parse(employeeData.availability);
        }
        if (employeeData.certifications && typeof employeeData.certifications === 'string') {
          parsedEmployee.certifications = JSON.parse(employeeData.certifications);
        }
        if (employeeData.contactInfo && typeof employeeData.contactInfo === 'string') {
          parsedEmployee.contactInfo = JSON.parse(employeeData.contactInfo);
        }
        if (employeeData.emergencyContact && typeof employeeData.emergencyContact === 'string') {
          parsedEmployee.emergencyContact = JSON.parse(employeeData.emergencyContact);
        }
      } catch (parseError) {
        logger.warn('Error parsing employee JSON data:', parseError);
      }
      
      return parsedEmployee;
    });
    
    // Get total count
    const countResult = await session.run(`MATCH (e:Employee) ${whereClause} RETURN count(e) as total`, params);
    const total = countResult.records[0].get('total').toNumber();

    res.json({
      employees,
      pagination: {
        total,
        limit: parseInt(limit.toString()),
        offset: parseInt(offset.toString()),
        pages: Math.ceil(total / parseInt(limit.toString()))
      }
    });
  } catch (error) {
    logger.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  } finally {
    await session.close();
  }
});

// Create employee with enhanced validation
app.post('/employees', async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.name || !req.body.email || !req.body.department) {
      return res.status(400).json({ error: 'Missing required fields: name, email, department' });
    }

    // Set default values for all optional fields
    const employeeWithDefaults = {
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      directReports: [],
      workload: 0,
      ...req.body,
      // Ensure all required Neo4j fields have values
      role: req.body.role || 'Employee',
      location: req.body.location || 'Not specified',
      skills: req.body.skills || [],
      availability: req.body.availability || {
        available: true,
        capacity: 100,
        maxHoursPerWeek: 40
      },
      contactInfo: req.body.contactInfo || {
        phone: '',
        address: ''
      },
      certifications: req.body.certifications || [],
      timezone: req.body.timezone || 'UTC',
      emergencyContact: req.body.emergencyContact || {
        name: '',
        relationship: '',
        phone: ''
      },
      manager: req.body.manager || null
    };

    const session = neo4jDriver.session();
    try {
      // Check if email already exists
      const existingResult = await session.run('MATCH (e:Employee {email: $email}) RETURN e', { email: employeeWithDefaults.email });
      if (existingResult.records.length > 0) {
        return res.status(409).json({ error: 'Employee with this email already exists' });
      }

      // Create in Neo4j with all required parameters (serialize complex objects)
      await session.run(`
        CREATE (e:Employee {
          id: $id,
          name: $name,
          email: $email,
          department: $department,
          skills: $skills,
          availability: $availability,
          location: $location,
          role: $role,
          certifications: $certifications,
          workload: $workload,
          timezone: $timezone,
          contactInfo: $contactInfo,
          emergencyContact: $emergencyContact,
          manager: $manager,
          directReports: $directReports,
          createdAt: $createdAt,
          updatedAt: $updatedAt
        })
      `, {
        ...employeeWithDefaults,
        skills: JSON.stringify(employeeWithDefaults.skills),
        availability: JSON.stringify(employeeWithDefaults.availability),
        certifications: JSON.stringify(employeeWithDefaults.certifications),
        contactInfo: JSON.stringify(employeeWithDefaults.contactInfo),
        emergencyContact: JSON.stringify(employeeWithDefaults.emergencyContact),
        createdAt: employeeWithDefaults.createdAt.toISOString(),
        updatedAt: employeeWithDefaults.updatedAt.toISOString()
      });

      // Create manager relationship if specified
      if (employeeWithDefaults.manager) {
        await session.run(`
          MATCH (e:Employee {id: $employeeId}), (m:Employee {id: $managerId})
          CREATE (e)-[:REPORTS_TO]->(m)
          WITH m
          SET m.directReports = coalesce(m.directReports, []) + $employeeId
        `, { employeeId: employeeWithDefaults.id, managerId: employeeWithDefaults.manager });
      }

      // Create in LDAP
      const entry = {
        cn: employeeWithDefaults.name,
        sn: employeeWithDefaults.name.split(' ').pop() || employeeWithDefaults.name,
        givenName: employeeWithDefaults.name.split(' ')[0],
        mail: employeeWithDefaults.email,
        objectClass: ['inetOrgPerson', 'person', 'top'],
        uid: employeeWithDefaults.id,
        ou: employeeWithDefaults.department,
        title: employeeWithDefaults.role,
        telephoneNumber: employeeWithDefaults.contactInfo?.phone || '',
        l: employeeWithDefaults.location
      };

      const dn = `uid=${employeeWithDefaults.id},ou=people,${process.env.LDAP_BASE_DN}`;
      
      ldapClient.add(dn, entry, (err: any) => {
        if (err) {
          logger.error('LDAP add error:', err);
        } else {
          logger.info(`Employee ${employeeWithDefaults.name} added to LDAP`);
        }
      });

      // Emit creation event
      hrEventEmitter.emit('employee_created', employeeWithDefaults);
      broadcastUpdate('employee_created', employeeWithDefaults);

      res.status(201).json(employeeWithDefaults);
    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Update employee
app.put('/employees/:id', async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body, updatedAt: new Date() };

  const session = neo4jDriver.session();
  try {
    // Build dynamic update query
    const setClause = Object.keys(updates)
      .map(key => `e.${key} = $${key}`)
      .join(', ');

    const result = await session.run(`
      MATCH (e:Employee {id: $id})
      SET ${setClause}
      RETURN e
    `, { id, ...updates });

    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const updatedEmployee = result.records[0].get('e').properties;

    // Update workload if necessary
    if (updates.assignments) {
      await WorkloadManager.updateEmployeeWorkload(id);
    }

    // Emit update event
    hrEventEmitter.emit('employee_updated', updatedEmployee);
    broadcastUpdate('employee_updated', updatedEmployee);

    res.json(updatedEmployee);
  } catch (error) {
    logger.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  } finally {
    await session.close();
  }
});

// Resource matching endpoint
app.post('/resources/match', async (req, res) => {
  try {
    const request: ResourceRequest = {
      id: uuidv4(),
      createdAt: new Date(),
      status: 'pending',
      assignedEmployees: [],
      ...req.body
    };

    const matches = await ResourceMatchingEngine.findOptimalMatch(request);
    
    res.json({
      requestId: request.id,
      matches: matches.map(employee => ({
        employee,
        matchScore: 'calculated_dynamically' // In real implementation, return actual score
      }))
    });
  } catch (error) {
    logger.error('Error matching resources:', error);
    res.status(500).json({ error: 'Failed to match resources' });
  }
});

// Get employee workload
app.get('/employees/:id/workload', async (req, res) => {
  const { id } = req.params;
  
  try {
    const workload = await WorkloadManager.updateEmployeeWorkload(id);
    res.json({ employeeId: id, workload, timestamp: new Date() });
  } catch (error) {
    logger.error('Error fetching workload:', error);
    res.status(500).json({ error: 'Failed to fetch workload' });
  }
});

// Get team workload overview
app.get('/workload/team/:identifier', async (req, res) => {
  const { identifier } = req.params;
  
  try {
    const teamWorkload = await WorkloadManager.getTeamWorkload(identifier);
    res.json({ team: identifier, members: teamWorkload, timestamp: new Date() });
  } catch (error) {
    logger.error('Error fetching team workload:', error);
    res.status(500).json({ error: 'Failed to fetch team workload' });
  }
});

// Skills analytics
app.get('/analytics/skills', async (req, res) => {
  if (!neo4jDriver) {
    // Return mock analytics when Neo4j is not available
    return res.json([
      { skill: 'JavaScript', distribution: [{ level: 'advanced', count: 2 }] },
      { skill: 'React', distribution: [{ level: 'expert', count: 1 }] },
      { skill: 'Node.js', distribution: [{ level: 'advanced', count: 1 }] }
    ]);
  }

  const session = neo4jDriver.session();
  try {
    // Simple query that works with JSON string storage
    const result = await session.run(`
      MATCH (e:Employee)
      WHERE e.skills IS NOT NULL AND e.skills <> '[]'
      RETURN e.skills as skillsJson, count(*) as employeeCount
    `);

    const skillsMap = new Map();
    
    result.records.forEach((record: any) => {
      try {
        const skillsJson = record.get('skillsJson');
        if (skillsJson && typeof skillsJson === 'string') {
          const skills = JSON.parse(skillsJson);
          skills.forEach((skill: any) => {
            if (skill.name) {
              if (!skillsMap.has(skill.name)) {
                skillsMap.set(skill.name, new Map());
              }
              const levelMap = skillsMap.get(skill.name);
              const level = skill.level || 'beginner';
              levelMap.set(level, (levelMap.get(level) || 0) + 1);
            }
          });
        }
      } catch (parseError) {
        logger.warn('Error parsing skills JSON in analytics:', parseError);
      }
    });

    const skillsAnalytics = Array.from(skillsMap.entries()).map(([skillName, levelMap]) => {
      const distribution = Array.from(levelMap.entries()).map(([level, count]) => ({
        level,
        count
      }));
      return {
        skill: skillName,
        distribution
      };
    });

    res.json(skillsAnalytics);
  } catch (error) {
    logger.error('Error fetching skills analytics:', error);
    res.status(500).json({ error: 'Failed to fetch skills analytics' });
  } finally {
    await session.close();
  }
});

// Organization hierarchy
app.get('/organization/hierarchy', async (req, res) => {
  const session = neo4jDriver.session();
  try {
    const result = await session.run(`
      MATCH (e:Employee)
      OPTIONAL MATCH (e)-[r:REPORTS_TO]->(m:Employee)
      RETURN e, m, r
      ORDER BY m.name, e.name
    `);
    
    const hierarchy = result.records.map((record: any) => ({
      employee: record.get('e').properties,
      manager: record.get('m') ? record.get('m').properties : null,
      relationship: record.get('r') ? record.get('r').properties : null
    }));
    
    res.json(hierarchy);
  } catch (error) {
    logger.error('Error fetching hierarchy:', error);
    res.status(500).json({ error: 'Failed to fetch hierarchy' });
  } finally {
    await session.close();
  }
});

// Certification verification endpoint (blockchain integration point)
app.post('/certifications/verify', async (req, res) => {
  const { certificationId, blockchainHash } = req.body;
  
  try {
    // This would integrate with blockchain verification service
    // For now, return mock verification
    const verified = blockchainHash && blockchainHash.length > 0;
    
    if (verified) {
      const session = neo4jDriver.session();
      try {
        await session.run(`
          MATCH (c:Certification {id: $certificationId})
          SET c.verified = true, c.verifiedAt = datetime()
          RETURN c
        `, { certificationId });
      } finally {
        await session.close();
      }
    }
    
    res.json({ 
      certificationId, 
      verified, 
      timestamp: new Date(),
      blockchainHash 
    });
  } catch (error) {
    logger.error('Error verifying certification:', error);
    res.status(500).json({ error: 'Failed to verify certification' });
  }
});

// Periodic workload recalculation
cron.schedule('0 */6 * * *', async () => {
  logger.info('Starting periodic workload recalculation');
  
  const session = neo4jDriver.session();
  try {
    const result = await session.run('MATCH (e:Employee) RETURN e.id as id');
    const employeeIds = result.records.map((record: any) => record.get('id'));
    
    for (const employeeId of employeeIds) {
      await WorkloadManager.updateEmployeeWorkload(employeeId);
      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
    }
    
    logger.info(`Workload recalculation completed for ${employeeIds.length} employees`);
  } catch (error) {
    logger.error('Error in periodic workload recalculation:', error);
  } finally {
    await session.close();
  }
});

// Initialize database on startup
initializeDatabase();

// Start server
const PORT = process.env.HR_SERVICE_PORT || 3001;
app.listen(PORT, () => {
  logger.info(`HR Resource Service running on port ${PORT}`);
  logger.info(`WebSocket server running on port ${parseInt(process.env.WS_PORT!) || 3011}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down HR Resource Service...');
  
  if (ldapClient && ldapClient.unbind) {
    ldapClient.unbind();
  }
  
  if (neo4jDriver) {
    await neo4jDriver.close();
  }
  
  wss.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down HR Resource Service...');
  
  if (ldapClient && ldapClient.unbind) {
    ldapClient.unbind();
  }
  
  if (neo4jDriver) {
    await neo4jDriver.close();
  }
  
  wss.close();
  process.exit(0);
});

export default app;
