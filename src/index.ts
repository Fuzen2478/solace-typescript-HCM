import { spawn } from 'child_process';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'hcm-system.log' })
  ]
});

// Service configurations
const services = [
  {
    name: 'HR Resource Service',
    path: './src/services/hr-resource/index.ts',
    port: process.env.HR_SERVICE_PORT || 3001
  },
  {
    name: 'Matching Engine',
    path: './src/services/matching-engine/index.ts',
    port: process.env.MATCHING_ENGINE_PORT || 3002
  },
  {
    name: 'Verification Service',
    path: './src/services/verification/index.ts',
    port: process.env.VERIFICATION_SERVICE_PORT || 3003
  },
  {
    name: 'Edge Agent',
    path: './src/services/edge-agent/index.ts',
    port: process.env.EDGE_AGENT_PORT || 3004
  }
];

// Start a service
function startService(service: typeof services[0]) {
  logger.info(`Starting ${service.name} on port ${service.port}...`);
  
  const child = spawn('npx', ['ts-node', service.path], {
    stdio: 'inherit',
    shell: true
  });

  child.on('error', (error) => {
    logger.error(`Error starting ${service.name}: ${error.message}`);
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      logger.error(`${service.name} exited with code ${code}`);
      // Restart service after 5 seconds
      setTimeout(() => startService(service), 5000);
    }
  });

  return child;
}

// Main function
async function main() {
  logger.info('=================================');
  logger.info('HCM System Starting...');
  logger.info('=================================');

  // Check if Docker services are running
  logger.info('Checking Docker services...');
  
  // Start all services
  const processes = services.map(service => startService(service));

  // Handle shutdown
  process.on('SIGINT', () => {
    logger.info('\nShutting down services...');
    processes.forEach(child => child.kill());
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('\nShutting down services...');
    processes.forEach(child => child.kill());
    process.exit(0);
  });

  logger.info('All services started!');
  logger.info('');
  logger.info('Service URLs:');
  logger.info(`- HR Resource: http://localhost:${services[0].port}`);
  logger.info(`- Matching Engine: http://localhost:${services[1].port}`);
  logger.info(`- Verification: http://localhost:${services[2].port}`);
  logger.info(`- Edge Agent: http://localhost:${services[3].port}`);
  logger.info('');
  logger.info('Press Ctrl+C to stop all services');
}

// Run main function
main().catch(error => {
  logger.error('Failed to start system:', error);
  process.exit(1);
});
