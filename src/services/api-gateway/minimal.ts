import express from 'express';
import cors from 'cors';
import winston from 'winston';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// Simple logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Express app
const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date(),
    mode: 'minimal',
    gateway: {
      uptime: process.uptime(),
      version: '1.0.0-minimal'
    }
  });
});

// Simple service discovery
const services = {
  'hr-resource': 'http://localhost:3001',
  'matching-engine': 'http://localhost:3002'
};

app.get('/services', (req, res) => {
  res.json({
    services: Object.entries(services).map(([name, url]) => ({
      name,
      url,
      status: 'unknown'
    })),
    timestamp: new Date()
  });
});

// Simple proxy for HR service
app.use('/api/hr/*', async (req, res) => {
  try {
    const targetPath = req.path.replace('/api/hr', '');
    const targetUrl = `${services['hr-resource']}${targetPath}`;
    
    const config: any = {
      method: req.method.toLowerCase(),
      url: targetUrl,
      timeout: 10000
    };

    if (['post', 'put', 'patch'].includes(config.method)) {
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
    } else {
      res.status(503).json({ 
        error: 'Service temporarily unavailable',
        timestamp: new Date()
      });
    }
  }
});

// Simple proxy for matching service
app.use('/api/matching/*', async (req, res) => {
  try {
    const targetPath = req.path.replace('/api/matching', '');
    const targetUrl = `${services['matching-engine']}${targetPath}`;
    
    const config: any = {
      method: req.method.toLowerCase(),
      url: targetUrl,
      timeout: 10000
    };

    if (['post', 'put', 'patch'].includes(config.method)) {
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
    } else {
      res.status(503).json({ 
        error: 'Service temporarily unavailable',
        timestamp: new Date()
      });
    }
  }
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

// Start server
const PORT = process.env.API_GATEWAY_PORT || 3000;
app.listen(PORT, () => {
  logger.info(`API Gateway (Minimal) running on port ${PORT}`);
  logger.info('Available routes:');
  logger.info('  GET  /health');
  logger.info('  GET  /services');
  logger.info('  ALL  /api/hr/*');
  logger.info('  ALL  /api/matching/*');
});

export default app;
