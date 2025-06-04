import express from 'express';
import { Gateway, Wallets, X509Identity } from 'fabric-network';
import FabricCAServices from 'fabric-ca-client';
import path from 'path';
import fs from 'fs';
import winston from 'winston';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import solace from 'solclientjs';

dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'verification.log' })
  ]
});

// Express app
const app = express();
app.use(express.json());

// Solace Setup
const factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10;
solace.SolclientFactory.init(factoryProps);

let solaceSession: solace.Session | null = null;

// Fabric configuration
const ccpPath = path.resolve(__dirname, '..', '..', '..', 'fabric', 'connection.json');
const walletPath = path.join(process.cwd(), 'wallet');

// Interfaces
interface Certification {
  id: string;
  employeeId: string;
  certificationName: string;
  issuer: string;
  issueDate: Date;
  expiryDate?: Date;
  verificationHash: string;
  status: 'valid' | 'expired' | 'revoked';
}

interface WorkHistory {
  id: string;
  employeeId: string;
  company: string;
  position: string;
  startDate: Date;
  endDate?: Date;
  achievements: string[];
  verifiedBy: string;
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
    'hcm/verification/request',
    'hcm/certification/validate'
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
async function handleSolaceMessage(message: solace.Message) {
  const topic = message.getDestination().getName();
  const payload = JSON.parse(message.getBinaryAttachment() as string);

  logger.info(`Received message on topic ${topic}:`, payload);

  switch (topic) {
    case 'hcm/verification/request':
      await handleVerificationRequest(payload);
      break;
    case 'hcm/certification/validate':
      await validateCertification(payload);
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

// Initialize Fabric CA client
async function initializeFabricCA() {
  try {
    const caURL = process.env.FABRIC_CA_URL!;
    const ca = new FabricCAServices(caURL);

    // Create wallet directory if it doesn't exist
    if (!fs.existsSync(walletPath)) {
      fs.mkdirSync(walletPath, { recursive: true });
    }

    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Check if admin identity exists
    const adminIdentity = await wallet.get('admin');
    if (!adminIdentity) {
      // Enroll admin
      const enrollment = await ca.enroll({
        enrollmentID: 'admin',
        enrollmentSecret: 'adminpw'
      });

      const x509Identity: X509Identity = {
        credentials: {
          certificate: enrollment.certificate,
          privateKey: enrollment.key.toBytes(),
        },
        mspId: 'Org1MSP',
        type: 'X.509',
      };

      await wallet.put('admin', x509Identity);
      logger.info('Admin identity enrolled successfully');
    }

    return { ca, wallet };
  } catch (error) {
    logger.error('Error initializing Fabric CA:', error);
    throw error;
  }
}

// Get or create user identity
async function getOrCreateUserIdentity(userId: string) {
  const { ca, wallet } = await initializeFabricCA();

  // Check if user already exists
  const userIdentity = await wallet.get(userId);
  if (userIdentity) {
    return userIdentity;
  }

  // Get admin identity for registering new user
  const adminIdentity = await wallet.get('admin');
  if (!adminIdentity) {
    throw new Error('Admin identity not found');
  }

  // Build admin user context
  const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
  const adminUser = await provider.getUserContext(adminIdentity, 'admin');

  // Register the user
  const secret = await ca.register({
    affiliation: 'org1.department1',
    enrollmentID: userId,
    role: 'client'
  }, adminUser);

  // Enroll the user
  const enrollment = await ca.enroll({
    enrollmentID: userId,
    enrollmentSecret: secret
  });

  const x509Identity: X509Identity = {
    credentials: {
      certificate: enrollment.certificate,
      privateKey: enrollment.key.toBytes(),
    },
    mspId: 'Org1MSP',
    type: 'X.509',
  };

  await wallet.put(userId, x509Identity);
  logger.info(`User ${userId} enrolled successfully`);

  return x509Identity;
}

// Connect to Fabric network
async function connectToFabric(userId: string) {
  const gateway = new Gateway();
  
  try {
    const { wallet } = await initializeFabricCA();
    
    // Ensure user identity exists
    await getOrCreateUserIdentity(userId);

    // Create connection profile
    const connectionProfile = {
      name: 'basic-network',
      version: '1.0.0',
      client: {
        organization: 'Org1',
        connection: {
          timeout: {
            peer: {
              endorser: '300',
              eventHub: '300',
              eventReg: '300'
            },
            orderer: '300'
          }
        }
      },
      channels: {
        mychannel: {
          orderers: ['orderer.example.com'],
          peers: {
            'peer0.org1.example.com': {}
          }
        }
      },
      organizations: {
        Org1: {
          mspid: 'Org1MSP',
          peers: ['peer0.org1.example.com'],
          certificateAuthorities: ['ca.org1.example.com']
        }
      },
      orderers: {
        'orderer.example.com': {
          url: process.env.FABRIC_ORDERER_URL!
        }
      },
      peers: {
        'peer0.org1.example.com': {
          url: process.env.FABRIC_PEER_URL!,
          eventUrl: 'grpc://localhost:7053'
        }
      },
      certificateAuthorities: {
        'ca.org1.example.com': {
          url: process.env.FABRIC_CA_URL!,
          caName: 'ca-org1'
        }
      }
    };

    await gateway.connect(connectionProfile as any, {
      wallet,
      identity: userId,
      discovery: { enabled: false, asLocalhost: true }
    });

    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('verification');

    return { gateway, contract };
  } catch (error) {
    logger.error('Error connecting to Fabric:', error);
    await gateway.disconnect();
    throw error;
  }
}

// Handle verification request
async function handleVerificationRequest(data: { employeeId: string, verificationType: string }) {
  try {
    const { gateway, contract } = await connectToFabric('verifier-service');

    const result = await contract.evaluateTransaction(
      'queryEmployeeCredentials',
      data.employeeId
    );

    const credentials = JSON.parse(result.toString());

    publishToSolace('hcm/verification/response', {
      employeeId: data.employeeId,
      verificationType: data.verificationType,
      credentials,
      verified: true
    });

    await gateway.disconnect();
  } catch (error) {
    logger.error('Error handling verification request:', error);
    
    publishToSolace('hcm/verification/response', {
      employeeId: data.employeeId,
      verificationType: data.verificationType,
      verified: false,
      error: error.message
    });
  }
}

// Validate certification
async function validateCertification(data: { certificationId: string }) {
  try {
    const { gateway, contract } = await connectToFabric('verifier-service');

    const result = await contract.evaluateTransaction(
      'validateCertification',
      data.certificationId
    );

    const validation = JSON.parse(result.toString());

    publishToSolace('hcm/certification/validation-result', {
      certificationId: data.certificationId,
      ...validation
    });

    await gateway.disconnect();
  } catch (error) {
    logger.error('Error validating certification:', error);
    
    publishToSolace('hcm/certification/validation-result', {
      certificationId: data.certificationId,
      valid: false,
      error: error.message
    });
  }
}

// API Routes

// Add certification to blockchain
app.post('/certifications', async (req, res) => {
  const certification: Certification = {
    id: uuidv4(),
    status: 'valid',
    verificationHash: '', // Will be generated by chaincode
    ...req.body
  };

  try {
    const { gateway, contract } = await connectToFabric(certification.employeeId);

    await contract.submitTransaction(
      'addCertification',
      certification.id,
      certification.employeeId,
      certification.certificationName,
      certification.issuer,
      certification.issueDate.toISOString(),
      certification.expiryDate?.toISOString() || ''
    );

    publishToSolace('hcm/certification/added', certification);

    res.status(201).json(certification);
    await gateway.disconnect();
  } catch (error) {
    logger.error('Error adding certification:', error);
    res.status(500).json({ error: 'Failed to add certification' });
  }
});

// Add work history
app.post('/work-history', async (req, res) => {
  const workHistory: WorkHistory = {
    id: uuidv4(),
    ...req.body
  };

  try {
    const { gateway, contract } = await connectToFabric(workHistory.employeeId);

    await contract.submitTransaction(
      'addWorkHistory',
      workHistory.id,
      workHistory.employeeId,
      workHistory.company,
      workHistory.position,
      workHistory.startDate.toISOString(),
      workHistory.endDate?.toISOString() || '',
      JSON.stringify(workHistory.achievements),
      workHistory.verifiedBy
    );

    publishToSolace('hcm/work-history/added', workHistory);

    res.status(201).json(workHistory);
    await gateway.disconnect();
  } catch (error) {
    logger.error('Error adding work history:', error);
    res.status(500).json({ error: 'Failed to add work history' });
  }
});

// Get employee credentials
app.get('/employees/:employeeId/credentials', async (req, res) => {
  const { employeeId } = req.params;

  try {
    const { gateway, contract } = await connectToFabric('verifier-service');

    const result = await contract.evaluateTransaction(
      'queryEmployeeCredentials',
      employeeId
    );

    const credentials = JSON.parse(result.toString());
    res.json(credentials);
    
    await gateway.disconnect();
  } catch (error) {
    logger.error('Error getting credentials:', error);
    res.status(500).json({ error: 'Failed to get credentials' });
  }
});

// Verify certification
app.post('/certifications/:certificationId/verify', async (req, res) => {
  const { certificationId } = req.params;

  try {
    const { gateway, contract } = await connectToFabric('verifier-service');

    const result = await contract.evaluateTransaction(
      'verifyCertification',
      certificationId
    );

    const verification = JSON.parse(result.toString());
    res.json(verification);
    
    await gateway.disconnect();
  } catch (error) {
    logger.error('Error verifying certification:', error);
    res.status(500).json({ error: 'Failed to verify certification' });
  }
});

// Get verification history
app.get('/verification-history/:employeeId', async (req, res) => {
  const { employeeId } = req.params;

  try {
    const { gateway, contract } = await connectToFabric('verifier-service');

    const result = await contract.evaluateTransaction(
      'getVerificationHistory',
      employeeId
    );

    const history = JSON.parse(result.toString());
    res.json(history);
    
    await gateway.disconnect();
  } catch (error) {
    logger.error('Error getting verification history:', error);
    res.status(500).json({ error: 'Failed to get verification history' });
  }
});

// Initialize chaincode (should be called once during setup)
app.post('/initialize-chaincode', async (req, res) => {
  try {
    const { gateway, contract } = await connectToFabric('admin');

    await contract.submitTransaction('initLedger');

    res.json({ message: 'Chaincode initialized successfully' });
    await gateway.disconnect();
  } catch (error) {
    logger.error('Error initializing chaincode:', error);
    res.status(500).json({ error: 'Failed to initialize chaincode' });
  }
});

// Start server
const PORT = process.env.VERIFICATION_SERVICE_PORT || 3003;
app.listen(PORT, () => {
  logger.info(`Verification Service running on port ${PORT}`);
  connectToSolace();
  
  // Initialize Fabric CA on startup
  initializeFabricCA().catch(error => {
    logger.error('Failed to initialize Fabric CA:', error);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (solaceSession) {
    solaceSession.disconnect();
  }
  process.exit(0);
});

export default app;
