import express from 'express';
import neo4j from 'neo4j-driver';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import dotenv from 'dotenv';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

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
    new winston.transports.File({ filename: 'verification.log' }),
    new winston.transports.File({ filename: 'verification-error.log', level: 'error' })
  ]
});

// Express app
const app = express();
app.use(express.json());

// Neo4j Driver
const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j', 
    process.env.NEO4J_PASSWORD || 'password'
  ),
  {
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 30000,
    connectionTimeout: 20000
  }
);

// Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT!) || 6379,
  retryDelayOnFailure: 100,
  retryTimes: 3
});

// Interfaces
interface Certification {
  id: string;
  employeeId: string;
  certificationName: string;
  issuer: string;
  issueDate: Date;
  expiryDate?: Date;
  verificationHash: string;
  status: 'valid' | 'expired' | 'revoked' | 'pending';
  verifiedBy?: string;
  verifiedAt?: Date;
  documentUrl?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
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
  verificationStatus: 'verified' | 'pending' | 'rejected';
  verificationDate?: Date;
  verificationNotes?: string;
  skills: string[];
  technologies: string[];
  projects: Project[];
  createdAt: Date;
  updatedAt: Date;
}

interface Project {
  name: string;
  description: string;
  role: string;
  technologies: string[];
  startDate: Date;
  endDate?: Date;
  achievements: string[];
}

interface VerificationRequest {
  id: string;
  type: 'certification' | 'work_history' | 'skill_assessment' | 'reference_check';
  targetId: string; // ID of certification, work history, etc.
  requestedBy: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  notes?: string;
  evidence: Evidence[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

interface Evidence {
  type: 'document' | 'reference' | 'test_result' | 'interview';
  description: string;
  url?: string;
  verifiedBy?: string;
  verifiedAt?: Date;
  score?: number;
  notes?: string;
}

interface SkillAssessment {
  id: string;
  employeeId: string;
  skillName: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  score: number; // 0-100
  assessmentType: 'test' | 'interview' | 'practical' | 'peer_review';
  assessedBy: string;
  assessmentDate: Date;
  validUntil?: Date;
  evidence: Evidence[];
  status: 'valid' | 'expired' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
}

// Verification Engine
class VerificationEngine {
  // Generate cryptographic hash for verification
  static generateVerificationHash(data: any): string {
    const dataString = JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString + process.env.VERIFICATION_SECRET).digest('hex');
  }

  // Verify hash integrity
  static verifyHash(data: any, hash: string): boolean {
    const expectedHash = this.generateVerificationHash(data);
    return expectedHash === hash;
  }

  // Create digital signature for document
  static createDigitalSignature(data: any, privateKey?: string): string {
    const secret = privateKey || process.env.VERIFICATION_SECRET || 'default-secret';
    const timestamp = Date.now();
    const payload = { data, timestamp };
    
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  // Verify digital signature
  static verifyDigitalSignature(data: any, signature: string, publicKey?: string): boolean {
    try {
      const secret = publicKey || process.env.VERIFICATION_SECRET || 'default-secret';
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(data))
        .digest('hex');
      
      return signature === expectedSignature;
    } catch (error) {
      logger.error('Error verifying digital signature:', error);
      return false;
    }
  }

  // Auto-verify certification based on issuer
  static async autoVerifyCertification(certification: Certification): Promise<boolean> {
    const trustedIssuers = [
      'AWS', 'Microsoft', 'Google', 'Oracle', 'IBM', 'Cisco', 'CompTIA',
      'PMI', 'Scrum.org', 'Salesforce', 'Adobe', 'Atlassian'
    ];

    // Check if issuer is in trusted list
    const isTrustedIssuer = trustedIssuers.some(issuer => 
      certification.issuer.toLowerCase().includes(issuer.toLowerCase())
    );

    if (!isTrustedIssuer) {
      return false;
    }

    // Additional verification logic can be added here
    // For example, API calls to issuer verification endpoints

    return true;
  }

  // Verify work history through references
  static async verifyWorkHistory(workHistory: WorkHistory, references: string[]): Promise<{
    verified: boolean;
    confidence: number;
    notes: string[];
  }> {
    const verificationNotes: string[] = [];
    let confidenceScore = 0;

    // Check for common red flags
    const duration = workHistory.endDate 
      ? (workHistory.endDate.getTime() - workHistory.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      : 0;

    if (duration < 1 && workHistory.endDate) {
      verificationNotes.push('Short employment duration (less than 1 month)');
      confidenceScore -= 20;
    } else if (duration >= 12) {
      verificationNotes.push('Long-term employment shows stability');
      confidenceScore += 20;
    }

    // Check achievements consistency
    if (workHistory.achievements.length > 0) {
      confidenceScore += 10;
      verificationNotes.push('Specific achievements provided');
    }

    // Check skills and technologies alignment
    if (workHistory.skills.length > 0 && workHistory.technologies.length > 0) {
      confidenceScore += 15;
      verificationNotes.push('Technical skills and technologies documented');
    }

    // References verification (simplified)
    if (references.length >= 2) {
      confidenceScore += 25;
      verificationNotes.push(`${references.length} references provided`);
    }

    // Base confidence
    confidenceScore += 50;

    const finalConfidence = Math.max(0, Math.min(100, confidenceScore));
    const verified = finalConfidence >= 70;

    return {
      verified,
      confidence: finalConfidence,
      notes: verificationNotes
    };
  }

  // Calculate overall employee verification score
  static async calculateEmployeeVerificationScore(employeeId: string, session: neo4j.Session): Promise<{
    overallScore: number;
    breakdown: Record<string, number>;
    recommendations: string[];
  }> {
    const breakdown: Record<string, number> = {
      certifications: 0,
      workHistory: 0,
      skillAssessments: 0,
      references: 0
    };
    const recommendations: string[] = [];

    try {
      // Get certifications score
      const certResult = await session.run(`
        MATCH (c:Certification {employeeId: $employeeId})
        RETURN 
          count(CASE WHEN c.status = 'valid' THEN 1 END) as validCerts,
          count(c) as totalCerts
      `, { employeeId });

      if (certResult.records.length > 0) {
        const record = certResult.records[0];
        const validCerts = record.get('validCerts').toNumber();
        const totalCerts = record.get('totalCerts').toNumber();
        
        if (totalCerts > 0) {
          breakdown.certifications = (validCerts / totalCerts) * 100;
        }
        
        if (validCerts < 2) {
          recommendations.push('Consider obtaining more professional certifications');
        }
      }

      // Get work history score
      const workResult = await session.run(`
        MATCH (w:WorkHistory {employeeId: $employeeId})
        RETURN 
          count(CASE WHEN w.verificationStatus = 'verified' THEN 1 END) as verifiedWork,
          count(w) as totalWork,
          avg(CASE WHEN w.endDate IS NOT NULL 
               THEN duration.between(date(w.startDate), date(w.endDate)).months 
               ELSE 12 END) as avgDuration
      `, { employeeId });

      if (workResult.records.length > 0) {
        const record = workResult.records[0];
        const verifiedWork = record.get('verifiedWork').toNumber();
        const totalWork = record.get('totalWork').toNumber();
        
        if (totalWork > 0) {
          breakdown.workHistory = (verifiedWork / totalWork) * 100;
        }
        
        if (verifiedWork === 0) {
          recommendations.push('Work history requires verification');
        }
      }

      // Get skill assessments score
      const skillResult = await session.run(`
        MATCH (s:SkillAssessment {employeeId: $employeeId})
        WHERE s.status = 'valid'
        RETURN avg(s.score) as avgScore, count(s) as totalAssessments
      `, { employeeId });

      if (skillResult.records.length > 0) {
        const record = skillResult.records[0];
        const avgScore = record.get('avgScore');
        const totalAssessments = record.get('totalAssessments').toNumber();
        
        if (avgScore && totalAssessments > 0) {
          breakdown.skillAssessments = avgScore.toNumber();
        }
        
        if (totalAssessments < 3) {
          recommendations.push('Complete more skill assessments for comprehensive evaluation');
        }
      }

      // Calculate overall score (weighted average)
      const weights = {
        certifications: 0.3,
        workHistory: 0.4,
        skillAssessments: 0.25,
        references: 0.05
      };

      const overallScore = Object.entries(breakdown).reduce((sum, [key, value]) => {
        return sum + (value * weights[key as keyof typeof weights]);
      }, 0);

      return {
        overallScore: Math.round(overallScore),
        breakdown,
        recommendations
      };

    } catch (error) {
      logger.error('Error calculating verification score:', error);
      return {
        overallScore: 0,
        breakdown,
        recommendations: ['Error calculating verification score']
      };
    }
  }

  // Real-time verification methods
  static async verifyCertificationRealTime(certification: any): Promise<{
    verified: boolean;
    score: number;
    confidence: number;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 0;
    
    // Check required fields
    if (!certification.issuer) {
      issues.push('Missing issuer information');
    } else {
      score += 20;
    }
    
    if (!certification.issueDate) {
      issues.push('Missing issue date');
    } else if (new Date(certification.issueDate) > new Date()) {
      issues.push('Issue date is in the future');
    } else {
      score += 20;
    }
    
    // Check expiry
    if (certification.expiryDate) {
      if (new Date(certification.expiryDate) < new Date()) {
        issues.push('Certification has expired');
      } else {
        score += 20;
      }
    } else {
      score += 20; // No expiry is fine
    }
    
    // Check trusted issuers
    const trustedIssuers = ['AWS', 'Microsoft', 'Google', 'Oracle', 'IBM', 'Cisco', 'CompTIA'];
    const isTrusted = trustedIssuers.some(issuer => 
      certification.issuer?.toLowerCase().includes(issuer.toLowerCase())
    );
    
    if (isTrusted) {
      score += 30;
      recommendations.push('Certification from trusted issuer');
    } else {
      recommendations.push('Consider getting certifications from well-known providers');
    }
    
    // Check verification hash
    if (certification.verificationHash && certification.verificationHash.length === 64) {
      score += 10;
    } else {
      issues.push('Invalid or missing verification hash');
    }
    
    const confidence = Math.min(100, score + (issues.length === 0 ? 20 : 0));
    
    return {
      verified: score >= 60 && issues.length === 0,
      score,
      confidence,
      issues,
      recommendations
    };
  }
  
  static async verifyWorkHistoryRealTime(workHistory: any): Promise<{
    verified: boolean;
    score: number;
    confidence: number;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 0;
    
    // Check required fields
    if (!workHistory.company) {
      issues.push('Missing company information');
    } else {
      score += 20;
    }
    
    if (!workHistory.position) {
      issues.push('Missing position information');
    } else {
      score += 20;
    }
    
    if (!workHistory.startDate) {
      issues.push('Missing start date');
    } else {
      score += 15;
    }
    
    // Check duration consistency
    if (workHistory.startDate && workHistory.endDate) {
      const start = new Date(workHistory.startDate);
      const end = new Date(workHistory.endDate);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30); // months
      
      if (duration < 1) {
        issues.push('Very short employment duration');
      } else if (duration >= 12) {
        score += 15;
        recommendations.push('Long-term employment shows stability');
      }
    }
    
    // Check for achievements and details
    if (workHistory.achievements && workHistory.achievements.length > 0) {
      score += 15;
      recommendations.push('Well-documented achievements');
    } else {
      recommendations.push('Add specific achievements and accomplishments');
    }
    
    // Check skills documentation
    if (workHistory.skills && workHistory.skills.length > 0) {
      score += 10;
    } else {
      recommendations.push('Document skills used in this role');
    }
    
    // Check verification status
    if (workHistory.verifiedBy) {
      score += 5;
    } else {
      recommendations.push('Obtain verification from former supervisor or HR');
    }
    
    const confidence = Math.min(100, score + (issues.length === 0 ? 15 : 0));
    
    return {
      verified: score >= 70 && issues.length === 0,
      score,
      confidence,
      issues,
      recommendations
    };
  }
  
  static async verifySkillAssessmentRealTime(assessment: any): Promise<{
    verified: boolean;
    score: number;
    confidence: number;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 0;
    
    // Check required fields
    if (!assessment.skillName) {
      issues.push('Missing skill name');
    } else {
      score += 20;
    }
    
    if (assessment.score === undefined || assessment.score === null) {
      issues.push('Missing assessment score');
    } else if (assessment.score < 0 || assessment.score > 100) {
      issues.push('Invalid score range');
    } else {
      score += 25;
      
      if (assessment.score >= 80) {
        recommendations.push('Excellent skill level demonstrated');
      } else if (assessment.score >= 60) {
        recommendations.push('Good skill level, consider advanced training');
      } else {
        recommendations.push('Skill needs improvement, recommend training');
      }
    }
    
    if (!assessment.assessmentType) {
      issues.push('Missing assessment type');
    } else {
      score += 15;
    }
    
    if (!assessment.assessedBy) {
      issues.push('Missing assessor information');
    } else {
      score += 15;
    }
    
    // Check assessment date
    if (!assessment.assessmentDate) {
      issues.push('Missing assessment date');
    } else {
      const assessmentAge = Date.now() - new Date(assessment.assessmentDate).getTime();
      const ageInDays = assessmentAge / (1000 * 60 * 60 * 24);
      
      if (ageInDays > 365) {
        issues.push('Assessment is over 1 year old');
        recommendations.push('Consider taking a recent assessment');
      } else {
        score += 10;
      }
    }
    
    // Check for evidence
    if (assessment.evidence && assessment.evidence.length > 0) {
      score += 10;
      recommendations.push('Well-documented with evidence');
    } else {
      recommendations.push('Add supporting evidence or documentation');
    }
    
    // Check validity period
    if (assessment.validUntil) {
      if (new Date(assessment.validUntil) < new Date()) {
        issues.push('Assessment validity has expired');
      } else {
        score += 5;
      }
    }
    
    const confidence = Math.min(100, score + (issues.length === 0 ? 10 : 0));
    
    return {
      verified: score >= 70 && issues.length === 0,
      score,
      confidence,
      issues,
      recommendations
    };
  }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    services: {
      neo4j: 'connected',
      redis: redis.status
    },
    version: '1.0.0'
  });
});

// Add certification
app.post('/certifications', async (req, res) => {
  try {
    const certification: Certification = {
      id: uuidv4(),
      status: 'pending',
      verificationHash: '',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...req.body
    };

    // Validate required fields
    if (!certification.employeeId || !certification.certificationName || !certification.issuer) {
      return res.status(400).json({ 
        error: 'Missing required fields: employeeId, certificationName, issuer' 
      });
    }

    // Generate verification hash
    const hashData = {
      employeeId: certification.employeeId,
      certificationName: certification.certificationName,
      issuer: certification.issuer,
      issueDate: certification.issueDate
    };
    certification.verificationHash = VerificationEngine.generateVerificationHash(hashData);

    // Auto-verify if from trusted issuer
    const autoVerified = await VerificationEngine.autoVerifyCertification(certification);
    if (autoVerified) {
      certification.status = 'valid';
      certification.verifiedBy = 'system';
      certification.verifiedAt = new Date();
    }

    const session = neo4jDriver.session();
    try {
      await session.run(`
        CREATE (c:Certification {
          id: $id,
          employeeId: $employeeId,
          certificationName: $certificationName,
          issuer: $issuer,
          issueDate: $issueDate,
          expiryDate: $expiryDate,
          verificationHash: $verificationHash,
          status: $status,
          verifiedBy: $verifiedBy,
          verifiedAt: $verifiedAt,
          documentUrl: $documentUrl,
          metadata: $metadata,
          createdAt: $createdAt,
          updatedAt: $updatedAt
        })
      `, {
        ...certification,
        issueDate: certification.issueDate.toISOString(),
        expiryDate: certification.expiryDate ? certification.expiryDate.toISOString() : null,
        verifiedAt: certification.verifiedAt ? certification.verifiedAt.toISOString() : null,
        metadata: JSON.stringify(certification.metadata)
      });

      // Cache for quick access
      await redis.setex(`cert:${certification.id}`, 3600, JSON.stringify(certification));

      logger.info(`Certification added: ${certification.id} for employee ${certification.employeeId}`);

      res.status(201).json({
        certification,
        autoVerified,
        message: autoVerified ? 'Certification added and auto-verified' : 'Certification added, pending verification'
      });

    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error('Error adding certification:', error);
    res.status(500).json({ error: 'Failed to add certification' });
  }
});

// Add work history
app.post('/work-history', async (req, res) => {
  try {
    const workHistory: WorkHistory = {
      id: uuidv4(),
      verificationStatus: 'pending',
      achievements: [],
      skills: [],
      technologies: [],
      projects: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...req.body
    };

    // Validate required fields
    if (!workHistory.employeeId || !workHistory.company || !workHistory.position) {
      return res.status(400).json({ 
        error: 'Missing required fields: employeeId, company, position' 
      });
    }

    const session = neo4jDriver.session();
    try {
      await session.run(`
        CREATE (w:WorkHistory {
          id: $id,
          employeeId: $employeeId,
          company: $company,
          position: $position,
          startDate: $startDate,
          endDate: $endDate,
          achievements: $achievements,
          verifiedBy: $verifiedBy,
          verificationStatus: $verificationStatus,
          verificationDate: $verificationDate,
          verificationNotes: $verificationNotes,
          skills: $skills,
          technologies: $technologies,
          projects: $projects,
          createdAt: $createdAt,
          updatedAt: $updatedAt
        })
      `, {
        ...workHistory,
        startDate: workHistory.startDate.toISOString(),
        endDate: workHistory.endDate ? workHistory.endDate.toISOString() : null,
        verificationDate: workHistory.verificationDate ? workHistory.verificationDate.toISOString() : null,
        achievements: JSON.stringify(workHistory.achievements),
        skills: JSON.stringify(workHistory.skills),
        technologies: JSON.stringify(workHistory.technologies),
        projects: JSON.stringify(workHistory.projects)
      });

      logger.info(`Work history added: ${workHistory.id} for employee ${workHistory.employeeId}`);

      res.status(201).json({
        workHistory,
        message: 'Work history added successfully'
      });

    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error('Error adding work history:', error);
    res.status(500).json({ error: 'Failed to add work history' });
  }
});

// Get employee credentials
app.get('/employees/:employeeId/credentials', async (req, res) => {
  const { employeeId } = req.params;

  const session = neo4jDriver.session();
  try {
    // Get certifications
    const certResult = await session.run(`
      MATCH (c:Certification {employeeId: $employeeId})
      RETURN c
      ORDER BY c.issueDate DESC
    `, { employeeId });

    // Get work history
    const workResult = await session.run(`
      MATCH (w:WorkHistory {employeeId: $employeeId})
      RETURN w
      ORDER BY w.startDate DESC
    `, { employeeId });

    // Get skill assessments
    const skillResult = await session.run(`
      MATCH (s:SkillAssessment {employeeId: $employeeId})
      RETURN s
      ORDER BY s.assessmentDate DESC
    `, { employeeId });

    const certifications = certResult.records.map(record => {
      const cert = record.get('c').properties;
      return {
        ...cert,
        issueDate: new Date(cert.issueDate),
        expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : null,
        verifiedAt: cert.verifiedAt ? new Date(cert.verifiedAt) : null,
        metadata: JSON.parse(cert.metadata || '{}')
      };
    });

    const workHistory = workResult.records.map(record => {
      const work = record.get('w').properties;
      return {
        ...work,
        startDate: new Date(work.startDate),
        endDate: work.endDate ? new Date(work.endDate) : null,
        verificationDate: work.verificationDate ? new Date(work.verificationDate) : null,
        achievements: JSON.parse(work.achievements || '[]'),
        skills: JSON.parse(work.skills || '[]'),
        technologies: JSON.parse(work.technologies || '[]'),
        projects: JSON.parse(work.projects || '[]')
      };
    });

    const skillAssessments = skillResult.records.map(record => {
      const skill = record.get('s').properties;
      return {
        ...skill,
        assessmentDate: new Date(skill.assessmentDate),
        validUntil: skill.validUntil ? new Date(skill.validUntil) : null,
        evidence: JSON.parse(skill.evidence || '[]')
      };
    });

    // Calculate verification score
    const verificationScore = await VerificationEngine.calculateEmployeeVerificationScore(employeeId, session);

    res.json({
      employeeId,
      certifications,
      workHistory,
      skillAssessments,
      verificationScore,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error getting credentials:', error);
    res.status(500).json({ error: 'Failed to get credentials' });
  } finally {
    await session.close();
  }
});

// Verify certification
app.post('/certifications/:certificationId/verify', async (req, res) => {
  const { certificationId } = req.params;
  const { verifiedBy, notes, evidence } = req.body;

  const session = neo4jDriver.session();
  try {
    const result = await session.run(`
      MATCH (c:Certification {id: $certificationId})
      SET c.status = 'valid',
          c.verifiedBy = $verifiedBy,
          c.verifiedAt = datetime(),
          c.verificationNotes = $notes,
          c.updatedAt = datetime()
      RETURN c
    `, { certificationId, verifiedBy, notes });

    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Certification not found' });
    }

    const certification = result.records[0].get('c').properties;

    logger.info(`Certification verified: ${certificationId} by ${verifiedBy}`);

    res.json({
      certificationId,
      status: 'verified',
      verifiedBy,
      verifiedAt: new Date(),
      notes,
      message: 'Certification verified successfully'
    });

  } catch (error) {
    logger.error('Error verifying certification:', error);
    res.status(500).json({ error: 'Failed to verify certification' });
  } finally {
    await session.close();
  }
});

// Create verification request
app.post('/verification-requests', async (req, res) => {
  try {
    const request: VerificationRequest = {
      id: uuidv4(),
      status: 'pending',
      priority: 'medium',
      evidence: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...req.body
    };

    const session = neo4jDriver.session();
    try {
      await session.run(`
        CREATE (vr:VerificationRequest {
          id: $id,
          type: $type,
          targetId: $targetId,
          requestedBy: $requestedBy,
          status: $status,
          priority: $priority,
          assignedTo: $assignedTo,
          notes: $notes,
          evidence: $evidence,
          createdAt: $createdAt,
          updatedAt: $updatedAt,
          completedAt: $completedAt
        })
      `, {
        ...request,
        evidence: JSON.stringify(request.evidence),
        completedAt: request.completedAt ? request.completedAt.toISOString() : null
      });

      res.status(201).json({
        request,
        message: 'Verification request created successfully'
      });

    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error('Error creating verification request:', error);
    res.status(500).json({ error: 'Failed to create verification request' });
  }
});

// Get verification analytics
app.get('/analytics/verification', async (req, res) => {
  const { timeRange = '30d' } = req.query;
  
  const session = neo4jDriver.session();
  try {
    const endDate = new Date();
    const startDate = new Date();
    switch (timeRange) {
      case '7d': startDate.setDate(endDate.getDate() - 7); break;
      case '30d': startDate.setDate(endDate.getDate() - 30); break;
      case '90d': startDate.setDate(endDate.getDate() - 90); break;
      default: startDate.setDate(endDate.getDate() - 30);
    }

    // Get certification stats
    const certStats = await session.run(`
      MATCH (c:Certification)
      WHERE c.createdAt >= datetime($startDate) AND c.createdAt <= datetime($endDate)
      RETURN 
        count(c) as totalCertifications,
        count(CASE WHEN c.status = 'valid' THEN 1 END) as verifiedCertifications,
        count(CASE WHEN c.status = 'pending' THEN 1 END) as pendingCertifications,
        count(CASE WHEN c.verifiedBy = 'system' THEN 1 END) as autoVerified
    `, { startDate: startDate.toISOString(), endDate: endDate.toISOString() });

    // Get work history stats
    const workStats = await session.run(`
      MATCH (w:WorkHistory)
      WHERE w.createdAt >= datetime($startDate) AND w.createdAt <= datetime($endDate)
      RETURN 
        count(w) as totalWorkHistory,
        count(CASE WHEN w.verificationStatus = 'verified' THEN 1 END) as verifiedWork,
        count(CASE WHEN w.verificationStatus = 'pending' THEN 1 END) as pendingWork
    `, { startDate: startDate.toISOString(), endDate: endDate.toISOString() });

    const certRecord = certStats.records[0];
    const workRecord = workStats.records[0];

    const analytics = {
      timeRange,
      period: { start: startDate, end: endDate },
      certifications: {
        total: certRecord.get('totalCertifications').toNumber(),
        verified: certRecord.get('verifiedCertifications').toNumber(),
        pending: certRecord.get('pendingCertifications').toNumber(),
        autoVerified: certRecord.get('autoVerified').toNumber(),
        verificationRate: 0
      },
      workHistory: {
        total: workRecord.get('totalWorkHistory').toNumber(),
        verified: workRecord.get('verifiedWork').toNumber(),
        pending: workRecord.get('pendingWork').toNumber(),
        verificationRate: 0
      }
    };

    analytics.certifications.verificationRate = analytics.certifications.total > 0 ?
      (analytics.certifications.verified / analytics.certifications.total) * 100 : 0;
    
    analytics.workHistory.verificationRate = analytics.workHistory.total > 0 ?
      (analytics.workHistory.verified / analytics.workHistory.total) * 100 : 0;

    res.json(analytics);

  } catch (error) {
    logger.error('Error getting verification analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  } finally {
    await session.close();
  }
});

// Real-time verification check
app.post('/verify/real-time', async (req, res) => {
  try {
    const { type, data, employeeId } = req.body;
    
    if (!type || !data || !employeeId) {
      return res.status(400).json({ error: 'Type, data, and employeeId required' });
    }
    
    let verificationResult;
    
    switch (type) {
      case 'certification':
        verificationResult = await VerificationEngine.verifyCertificationRealTime(data);
        break;
      case 'work_history':
        verificationResult = await VerificationEngine.verifyWorkHistoryRealTime(data);
        break;
      case 'skill_assessment':
        verificationResult = await VerificationEngine.verifySkillAssessmentRealTime(data);
        break;
      default:
        return res.status(400).json({ error: 'Invalid verification type' });
    }
    
    res.json({
      employeeId,
      type,
      verificationResult,
      timestamp: new Date()
    });
    
  } catch (error) {
    logger.error('Error in real-time verification:', error);
    res.status(500).json({ error: 'Failed to perform real-time verification' });
  }
});

// Batch verification
app.post('/verify/batch', async (req, res) => {
  try {
    const { items } = req.body; // Array of {type, data, employeeId}
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array required' });
    }
    
    const results = [];
    
    for (const item of items) {
      try {
        let verificationResult;
        
        switch (item.type) {
          case 'certification':
            verificationResult = await VerificationEngine.verifyCertificationRealTime(item.data);
            break;
          case 'work_history':
            verificationResult = await VerificationEngine.verifyWorkHistoryRealTime(item.data);
            break;
          case 'skill_assessment':
            verificationResult = await VerificationEngine.verifySkillAssessmentRealTime(item.data);
            break;
          default:
            verificationResult = { verified: false, error: 'Invalid type' };
        }
        
        results.push({
          employeeId: item.employeeId,
          type: item.type,
          verificationResult,
          status: 'completed'
        });
        
      } catch (error: any) {
        results.push({
          employeeId: item.employeeId,
          type: item.type,
          verificationResult: { verified: false, error: error.message },
          status: 'failed'
        });
      }
    }
    
    res.json({
      totalItems: items.length,
      completedItems: results.filter(r => r.status === 'completed').length,
      failedItems: results.filter(r => r.status === 'failed').length,
      results,
      timestamp: new Date()
    });
    
  } catch (error) {
    logger.error('Error in batch verification:', error);
    res.status(500).json({ error: 'Failed to perform batch verification' });
  }
});

// Get verification queue status
app.get('/queue/status', async (req, res) => {
  try {
    const session = neo4jDriver.session();
    
    const queueStats = await session.run(`
      MATCH (vr:VerificationRequest)
      RETURN 
        count(CASE WHEN vr.status = 'pending' THEN 1 END) as pending,
        count(CASE WHEN vr.status = 'in_progress' THEN 1 END) as inProgress,
        count(CASE WHEN vr.status = 'completed' THEN 1 END) as completed,
        count(CASE WHEN vr.priority = 'urgent' AND vr.status = 'pending' THEN 1 END) as urgent
    `);
    
    const stats = queueStats.records[0];
    
    await session.close();
    
    res.json({
      queue: {
        pending: stats.get('pending').toNumber(),
        inProgress: stats.get('inProgress').toNumber(),
        completed: stats.get('completed').toNumber(),
        urgent: stats.get('urgent').toNumber()
      },
      estimatedProcessingTime: '15-30 minutes',
      timestamp: new Date()
    });
    
  } catch (error) {
    logger.error('Error getting queue status:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// Initialize database schema
const initializeDatabase = async () => {
  const session = neo4jDriver.session();
  try {
    await session.run('CREATE CONSTRAINT cert_id IF NOT EXISTS FOR (c:Certification) REQUIRE c.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT work_id IF NOT EXISTS FOR (w:WorkHistory) REQUIRE w.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT skill_id IF NOT EXISTS FOR (s:SkillAssessment) REQUIRE s.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT vr_id IF NOT EXISTS FOR (vr:VerificationRequest) REQUIRE vr.id IS UNIQUE');
    
    await session.run('CREATE INDEX cert_employee IF NOT EXISTS FOR (c:Certification) ON (c.employeeId)');
    await session.run('CREATE INDEX work_employee IF NOT EXISTS FOR (w:WorkHistory) ON (w.employeeId)');
    await session.run('CREATE INDEX cert_status IF NOT EXISTS FOR (c:Certification) ON (c.status)');
    
    logger.info('Verification Service database schema initialized successfully');
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
    
    logger.info('All Verification Service services initialized successfully');
  } catch (error) {
    logger.error('Error initializing services:', error);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.VERIFICATION_SERVICE_PORT || 3003;
app.listen(PORT, async () => {
  logger.info(`Verification Service running on port ${PORT}`);
  
  await initializeServices();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down Verification Service...');
  await redis.disconnect();
  await neo4jDriver.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down Verification Service...');
  await redis.disconnect();
  await neo4jDriver.close();
  process.exit(0);
});

export default app;
