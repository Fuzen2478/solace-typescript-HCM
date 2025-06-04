import express from 'express';
import ldap from 'ldapjs';
import neo4j from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'hr-resource.log' })
  ]
});

// Express app
const app = express();
app.use(express.json());

// LDAP Client
const ldapClient = ldap.createClient({
  url: process.env.LDAP_URL!
});

// Neo4j Driver
const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
);

// Employee interface
interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  skills: string[];
  availability: boolean;
  location: string;
  role: string;
}

// LDAP bind
ldapClient.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_PASSWORD!, (err) => {
  if (err) {
    logger.error('LDAP bind failed:', err);
  } else {
    logger.info('LDAP bind successful');
  }
});

// API Routes

// Get all employees
app.get('/employees', async (req, res) => {
  const session = neo4jDriver.session();
  try {
    const result = await session.run('MATCH (e:Employee) RETURN e');
    const employees = result.records.map(record => record.get('e').properties);
    res.json(employees);
  } catch (error) {
    logger.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  } finally {
    await session.close();
  }
});

// Create employee
app.post('/employees', async (req, res) => {
  const employee: Employee = {
    id: uuidv4(),
    ...req.body
  };

  const session = neo4jDriver.session();
  try {
    // Create in Neo4j
    await session.run(
      `CREATE (e:Employee {
        id: $id,
        name: $name,
        email: $email,
        department: $department,
        skills: $skills,
        availability: $availability,
        location: $location,
        role: $role
      })`,
      employee
    );

    // Create in LDAP
    const entry = {
      cn: employee.name,
      sn: employee.name.split(' ').pop() || employee.name,
      mail: employee.email,
      objectClass: ['inetOrgPerson', 'person', 'top'],
      uid: employee.id
    };

    const dn = `uid=${employee.id},ou=people,${process.env.LDAP_BASE_DN}`;
    
    ldapClient.add(dn, entry, (err) => {
      if (err) {
        logger.error('LDAP add error:', err);
      }
    });

    res.status(201).json(employee);
  } catch (error) {
    logger.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  } finally {
    await session.close();
  }
});

// Find employees by skill
app.get('/employees/by-skill/:skill', async (req, res) => {
  const { skill } = req.params;
  const session = neo4jDriver.session();
  
  try {
    const result = await session.run(
      'MATCH (e:Employee) WHERE $skill IN e.skills RETURN e',
      { skill }
    );
    const employees = result.records.map(record => record.get('e').properties);
    res.json(employees);
  } catch (error) {
    logger.error('Error finding employees by skill:', error);
    res.status(500).json({ error: 'Failed to find employees' });
  } finally {
    await session.close();
  }
});

// Update employee availability
app.patch('/employees/:id/availability', async (req, res) => {
  const { id } = req.params;
  const { availability } = req.body;
  
  const session = neo4jDriver.session();
  try {
    await session.run(
      'MATCH (e:Employee {id: $id}) SET e.availability = $availability RETURN e',
      { id, availability }
    );
    res.json({ id, availability });
  } catch (error) {
    logger.error('Error updating availability:', error);
    res.status(500).json({ error: 'Failed to update availability' });
  } finally {
    await session.close();
  }
});

// Get organization hierarchy
app.get('/organization/hierarchy', async (req, res) => {
  const session = neo4jDriver.session();
  try {
    const result = await session.run(`
      MATCH (e:Employee)-[r:REPORTS_TO]->(m:Employee)
      RETURN e, r, m
    `);
    
    const hierarchy = result.records.map(record => ({
      employee: record.get('e').properties,
      manager: record.get('m').properties
    }));
    
    res.json(hierarchy);
  } catch (error) {
    logger.error('Error fetching hierarchy:', error);
    res.status(500).json({ error: 'Failed to fetch hierarchy' });
  } finally {
    await session.close();
  }
});

// Start server
const PORT = process.env.HR_SERVICE_PORT || 3001;
app.listen(PORT, () => {
  logger.info(`HR Resource Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  ldapClient.unbind();
  await neo4jDriver.close();
  process.exit(0);
});

export default app;
