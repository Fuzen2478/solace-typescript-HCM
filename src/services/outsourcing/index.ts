import express from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import dotenv from 'dotenv';

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
    new winston.transports.File({ filename: 'outsourcing.log' })
  ]
});

const app = express();
app.use(express.json());

// Mock external outsourcing providers
const OUTSOURCING_PROVIDERS = [
  {
    id: 'freelancer-pro',
    name: 'FreelancerPro',
    apiUrl: 'https://api.freelancerpro.com',
    skills: ['JavaScript', 'React', 'Node.js', 'Python', 'DevOps'],
    hourlyRate: { min: 25, max: 80 },
    availability: 'high',
    rating: 4.7
  },
  {
    id: 'tech-experts',
    name: 'TechExperts',
    apiUrl: 'https://api.techexperts.com',
    skills: ['Java', 'Spring', 'AWS', 'Docker', 'Kubernetes'],
    hourlyRate: { min: 35, max: 120 },
    availability: 'medium',
    rating: 4.8
  },
  {
    id: 'global-talent',
    name: 'GlobalTalent',
    apiUrl: 'https://api.globaltalent.com',
    skills: ['PHP', 'Laravel', 'Vue.js', 'Database', 'API'],
    hourlyRate: { min: 20, max: 60 },
    availability: 'high',
    rating: 4.5
  }
];

interface OutsourcingRequest {
  id: string;
  requiredSkills: string[];
  estimatedHours: number;
  maxBudget: number;
  deadline: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  location?: string;
  remoteAllowed: boolean;
  createdAt: Date;
}

interface OutsourcingProposal {
  providerId: string;
  providerName: string;
  freelancers: FreelancerProfile[];
  totalCost: number;
  estimatedDelivery: Date;
  matchScore: number;
  advantages: string[];
  risks: string[];
}

interface FreelancerProfile {
  id: string;
  name: string;
  skills: string[];
  experience: number;
  hourlyRate: number;
  rating: number;
  availability: 'available' | 'busy' | 'unavailable';
  timezone: string;
  portfolio: string[];
}

// Simulate external API calls
class OutsourcingAPI {
  static async findFreelancers(provider: any, skills: string[], budget: number): Promise<FreelancerProfile[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    const relevantSkills = skills.filter(skill => 
      provider.skills.some(providerSkill => 
        providerSkill.toLowerCase().includes(skill.toLowerCase()) ||
        skill.toLowerCase().includes(providerSkill.toLowerCase())
      )
    );
    
    if (relevantSkills.length === 0) return [];
    
    const freelancerCount = Math.floor(Math.random() * 5) + 1;
    const freelancers: FreelancerProfile[] = [];
    
    for (let i = 0; i < freelancerCount; i++) {
      const hourlyRate = provider.hourlyRate.min + 
        Math.random() * (provider.hourlyRate.max - provider.hourlyRate.min);
      
      if (hourlyRate <= budget) {
        freelancers.push({
          id: `${provider.id}-freelancer-${i + 1}`,
          name: this.generateFreelancerName(),
          skills: this.selectRandomSkills(provider.skills, relevantSkills),
          experience: Math.floor(Math.random() * 10) + 1,
          hourlyRate: Math.round(hourlyRate),
          rating: 3.5 + Math.random() * 1.5,
          availability: Math.random() > 0.3 ? 'available' : 'busy',
          timezone: this.getRandomTimezone(),
          portfolio: this.generatePortfolio()
        });
      }
    }
    
    return freelancers;
  }
  
  private static generateFreelancerName(): string {
    const firstNames = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Avery', 'Quinn'];
    const lastNames = ['Chen', 'Smith', 'Garcia', 'Kim', 'Johnson', 'Brown', 'Davis', 'Miller'];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  }
  
  private static selectRandomSkills(providerSkills: string[], requiredSkills: string[]): string[] {
    const skills = [...requiredSkills];
    const additionalSkills = providerSkills.filter(skill => !requiredSkills.includes(skill));
    const additionalCount = Math.floor(Math.random() * 3);
    
    for (let i = 0; i < additionalCount && i < additionalSkills.length; i++) {
      skills.push(additionalSkills[Math.floor(Math.random() * additionalSkills.length)]);
    }
    
    return [...new Set(skills)];
  }
  
  private static getRandomTimezone(): string {
    const timezones = ['UTC', 'UTC+1', 'UTC+2', 'UTC-5', 'UTC-8', 'UTC+9', 'UTC+5:30'];
    return timezones[Math.floor(Math.random() * timezones.length)];
  }
  
  private static generatePortfolio(): string[] {
    const projects = [
      'E-commerce Platform', 'Mobile App', 'API Development', 'Cloud Migration',
      'Database Optimization', 'DevOps Pipeline', 'Web Application', 'Microservices'
    ];
    const count = Math.floor(Math.random() * 4) + 1;
    return projects.sort(() => 0.5 - Math.random()).slice(0, count);
  }
}

// Main outsourcing matching engine
class OutsourcingMatchingEngine {
  static async findBestProviders(request: OutsourcingRequest): Promise<OutsourcingProposal[]> {
    const proposals: OutsourcingProposal[] = [];
    
    for (const provider of OUTSOURCING_PROVIDERS) {
      try {
        const freelancers = await OutsourcingAPI.findFreelancers(
          provider, 
          request.requiredSkills, 
          request.maxBudget / request.estimatedHours
        );
        
        if (freelancers.length === 0) continue;
        
        const availableFreelancers = freelancers.filter(f => f.availability === 'available');
        if (availableFreelancers.length === 0) continue;
        
        // Calculate match score
        const matchScore = this.calculateMatchScore(provider, availableFreelancers, request);
        
        // Estimate cost and delivery
        const selectedFreelancers = this.selectOptimalFreelancers(availableFreelancers, request);
        const totalCost = this.calculateTotalCost(selectedFreelancers, request.estimatedHours);
        const estimatedDelivery = this.calculateDeliveryDate(selectedFreelancers, request);
        
        const proposal: OutsourcingProposal = {
          providerId: provider.id,
          providerName: provider.name,
          freelancers: selectedFreelancers,
          totalCost,
          estimatedDelivery,
          matchScore,
          advantages: this.getAdvantages(provider, selectedFreelancers),
          risks: this.getRisks(provider, selectedFreelancers, request)
        };
        
        proposals.push(proposal);
        
      } catch (error) {
        logger.error(`Error fetching from provider ${provider.name}:`, error);
      }
    }
    
    // Sort by match score
    return proposals.sort((a, b) => b.matchScore - a.matchScore);
  }
  
  private static calculateMatchScore(provider: any, freelancers: FreelancerProfile[], request: OutsourcingRequest): number {
    let score = 0;
    
    // Provider base score
    score += provider.rating * 10;
    
    // Skill match score
    const requiredSkills = request.requiredSkills;
    const availableSkills = new Set(freelancers.flatMap(f => f.skills));
    const skillMatch = requiredSkills.filter(skill => availableSkills.has(skill)).length;
    score += (skillMatch / requiredSkills.length) * 30;
    
    // Experience score
    const avgExperience = freelancers.reduce((sum, f) => sum + f.experience, 0) / freelancers.length;
    score += Math.min(avgExperience * 2, 20);
    
    // Budget fit score
    const avgRate = freelancers.reduce((sum, f) => sum + f.hourlyRate, 0) / freelancers.length;
    const budgetPerHour = request.maxBudget / request.estimatedHours;
    if (avgRate <= budgetPerHour) {
      score += 20;
    } else {
      score -= (avgRate - budgetPerHour) / budgetPerHour * 20;
    }
    
    // Availability score
    score += freelancers.length * 5;
    
    return Math.max(0, Math.min(100, score));
  }
  
  private static selectOptimalFreelancers(freelancers: FreelancerProfile[], request: OutsourcingRequest): FreelancerProfile[] {
    const budgetPerHour = request.maxBudget / request.estimatedHours;
    
    // Filter by budget and sort by rating
    const affordableFreelancers = freelancers
      .filter(f => f.hourlyRate <= budgetPerHour)
      .sort((a, b) => b.rating - a.rating);
    
    // Select optimal team (1-3 freelancers based on project size)
    const teamSize = request.estimatedHours > 80 ? 3 : request.estimatedHours > 40 ? 2 : 1;
    return affordableFreelancers.slice(0, Math.min(teamSize, affordableFreelancers.length));
  }
  
  private static calculateTotalCost(freelancers: FreelancerProfile[], estimatedHours: number): number {
    const avgRate = freelancers.reduce((sum, f) => sum + f.hourlyRate, 0) / freelancers.length;
    const teamEfficiency = freelancers.length > 1 ? 0.8 : 1; // Team coordination overhead
    return Math.round(avgRate * estimatedHours * teamEfficiency);
  }
  
  private static calculateDeliveryDate(freelancers: FreelancerProfile[], request: OutsourcingRequest): Date {
    const baseHours = request.estimatedHours;
    const teamSize = freelancers.length;
    const avgExperience = freelancers.reduce((sum, f) => sum + f.experience, 0) / freelancers.length;
    
    // Calculate delivery time based on team size and experience
    const parallelEfficiency = teamSize > 1 ? 0.7 : 1;
    const experienceMultiplier = 1 + (avgExperience - 3) * 0.1;
    
    const effectiveHours = baseHours / (teamSize * parallelEfficiency * experienceMultiplier);
    const workDays = Math.ceil(effectiveHours / 8); // 8 hours per day
    
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + workDays);
    
    return deliveryDate;
  }
  
  private static getAdvantages(provider: any, freelancers: FreelancerProfile[]): string[] {
    const advantages = [];
    
    if (provider.rating >= 4.7) {
      advantages.push('Highly rated provider');
    }
    
    const avgRating = freelancers.reduce((sum, f) => sum + f.rating, 0) / freelancers.length;
    if (avgRating >= 4.5) {
      advantages.push('Experienced freelancers');
    }
    
    if (freelancers.length > 1) {
      advantages.push('Team-based approach for faster delivery');
    }
    
    const avgRate = freelancers.reduce((sum, f) => sum + f.hourlyRate, 0) / freelancers.length;
    if (avgRate < 50) {
      advantages.push('Cost-effective solution');
    }
    
    return advantages;
  }
  
  private static getRisks(provider: any, freelancers: FreelancerProfile[], request: OutsourcingRequest): string[] {
    const risks = [];
    
    if (provider.availability === 'low') {
      risks.push('Limited availability of freelancers');
    }
    
    const avgExperience = freelancers.reduce((sum, f) => sum + f.experience, 0) / freelancers.length;
    if (avgExperience < 2) {
      risks.push('Limited experience in required technologies');
    }
    
    if (freelancers.length > 2) {
      risks.push('Team coordination overhead');
    }
    
    const hasTimezoneIssues = freelancers.some(f => 
      !['UTC', 'UTC+1', 'UTC-5'].includes(f.timezone)
    );
    if (hasTimezoneIssues) {
      risks.push('Timezone differences may affect communication');
    }
    
    return risks;
  }
}

// API Routes

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    providers: OUTSOURCING_PROVIDERS.length,
    version: '1.0.0'
  });
});

// Get available providers
app.get('/providers', (req, res) => {
  res.json({
    providers: OUTSOURCING_PROVIDERS.map(p => ({
      id: p.id,
      name: p.name,
      skills: p.skills,
      hourlyRate: p.hourlyRate,
      availability: p.availability,
      rating: p.rating
    })),
    timestamp: new Date()
  });
});

// Submit outsourcing request and get proposals
app.post('/requests', async (req, res) => {
  try {
    const request: OutsourcingRequest = {
      id: uuidv4(),
      createdAt: new Date(),
      remoteAllowed: true,
      priority: 'medium',
      ...req.body
    };

    // Validate required fields
    if (!request.requiredSkills || !request.estimatedHours || !request.maxBudget) {
      return res.status(400).json({ 
        error: 'Missing required fields: requiredSkills, estimatedHours, maxBudget' 
      });
    }

    logger.info(`Processing outsourcing request: ${request.id}`);

    // Find best providers
    const proposals = await OutsourcingMatchingEngine.findBestProviders(request);

    res.json({
      requestId: request.id,
      request,
      proposals,
      totalProviders: proposals.length,
      bestMatch: proposals[0] || null,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error processing outsourcing request:', error);
    res.status(500).json({ error: 'Failed to process outsourcing request' });
  }
});

// Get request status
app.get('/requests/:requestId', (req, res) => {
  const { requestId } = req.params;
  
  // Mock request status
  res.json({
    requestId,
    status: 'completed',
    proposals: 3,
    bestProvider: 'FreelancerPro',
    timestamp: new Date()
  });
});

// Accept a proposal
app.post('/proposals/:proposalId/accept', (req, res) => {
  const { proposalId } = req.params;
  
  logger.info(`Proposal accepted: ${proposalId}`);
  
  res.json({
    proposalId,
    status: 'accepted',
    contractId: uuidv4(),
    nextSteps: [
      'Contract will be generated within 24 hours',
      'Freelancers will be notified',
      'Project kickoff meeting will be scheduled'
    ],
    timestamp: new Date()
  });
});

// Get outsourcing analytics
app.get('/analytics', (req, res) => {
  const { timeRange = '30d' } = req.query;
  
  // Mock analytics data
  const analytics = {
    timeRange,
    totalRequests: 45,
    successfulMatches: 38,
    averageMatchTime: '2.3 hours',
    averageCost: 3200,
    topSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'AWS'],
    topProviders: [
      { name: 'FreelancerPro', requests: 18, rating: 4.7 },
      { name: 'TechExperts', requests: 12, rating: 4.8 },
      { name: 'GlobalTalent', requests: 8, rating: 4.5 }
    ],
    costSavings: {
      internal: 5000,
      outsourced: 3200,
      savings: 1800,
      percentage: 36
    }
  };
  
  res.json(analytics);
});

// Start server
const PORT = process.env.OUTSOURCING_SERVICE_PORT || 3006;
app.listen(PORT, () => {
  logger.info(`Outsourcing Service running on port ${PORT}`);
});

export default app;