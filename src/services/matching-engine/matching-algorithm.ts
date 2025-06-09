import { Task, Employee, MatchingResult, MatchingReason, RiskFactor, logger } from './index';
import neo4j from 'neo4j-driver';

// Advanced Matching Engine
export class AdvancedMatchingEngine {
  static async findOptimalMatches(task: Task, maxResults: number = 10, session: neo4j.Session): Promise<MatchingResult[]> {
    try {
      logger.info(`Finding matches for task: ${task.id}`);

      // Get all available employees with relevant skills
      const employeeQuery = `
        MATCH (e:Employee)
        WHERE e.availability.available = true
        AND (
          any(requiredSkill IN $requiredSkills 
              WHERE any(empSkill IN e.skills 
                        WHERE empSkill.name = requiredSkill.name))
          OR $departmentRestriction IS NULL 
          OR e.department = $departmentRestriction
        )
        RETURN e
        ORDER BY e.workload ASC, e.performanceRating DESC
        LIMIT 50
      `;

      const result = await session.run(employeeQuery, {
        requiredSkills: task.requiredSkills.map(rs => ({ name: rs.name })),
        departmentRestriction: task.departmentRestriction
      });

      const candidates: MatchingResult[] = [];

      for (const record of result.records) {
        const employee = record.get('e').properties as Employee;
        
        const matchResult = await this.calculateDetailedMatch(task, employee, session);
        if (matchResult.score > 0) {
          candidates.push(matchResult);
        }
      }

      // Sort by combined score and confidence
      candidates.sort((a, b) => {
        const scoreA = a.score * a.confidence;
        const scoreB = b.score * b.confidence;
        return scoreB - scoreA;
      });

      const finalResults = candidates.slice(0, maxResults);
      
      logger.info(`Found ${finalResults.length} potential matches for task ${task.id}`);
      
      return finalResults;

    } catch (error) {
      logger.error('Error in findOptimalMatches:', error);
      return [];
    }
  }

  static async calculateDetailedMatch(task: Task, employee: Employee, session: neo4j.Session): Promise<MatchingResult> {
    const reasons: MatchingReason[] = [];
    const risks: RiskFactor[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // 1. Skills Matching (40% weight)
    const skillsMatch = await this.calculateSkillsMatch(task, employee);
    totalScore += skillsMatch.score * 0.4;
    totalWeight += 0.4;
    reasons.push(...skillsMatch.reasons);

    // 2. Availability & Workload (30% weight)
    const availabilityMatch = this.calculateAvailabilityMatch(task, employee);
    totalScore += availabilityMatch.score * 0.3;
    totalWeight += 0.3;
    reasons.push(...availabilityMatch.reasons);

    // 3. Location Match (15% weight)
    const locationMatch = this.calculateLocationMatch(task, employee);
    totalScore += locationMatch.score * 0.15;
    totalWeight += 0.15;
    reasons.push(...locationMatch.reasons);

    // 4. Experience & Performance (15% weight)
    const experienceMatch = await this.calculateExperienceMatch(task, employee, session);
    totalScore += experienceMatch.score * 0.15;
    totalWeight += 0.15;
    reasons.push(...experienceMatch.reasons);

    // Calculate risks
    risks.push(...this.assessRisks(task, employee));

    // Calculate confidence based on data quality and risk level
    const confidence = this.calculateConfidence(employee, risks);

    // Estimate completion time
    const estimatedTime = this.estimateCompletionTime(task, employee);

    const finalScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;

    return {
      taskId: task.id,
      employeeId: employee.id,
      employee,
      score: Math.round(finalScore),
      confidence,
      reasons,
      risks,
      estimatedCompletionTime: estimatedTime,
      recommendedStartDate: this.calculateRecommendedStartDate(employee)
    };
  }

  private static async calculateSkillsMatch(task: Task, employee: Employee) {
    let score = 0;
    const reasons: MatchingReason[] = [];
    
    const employeeSkillsMap = new Map(employee.skills.map(s => [s.name, s]));
    
    let mandatorySkillsMatched = 0;
    let totalMandatorySkills = task.requiredSkills.filter(rs => rs.mandatory).length;
    
    let weightedSkillScore = 0;
    let totalWeight = 0;

    for (const requiredSkill of task.requiredSkills) {
      const employeeSkill = employeeSkillsMap.get(requiredSkill.name);
      
      if (employeeSkill) {
        const levelScore = this.getSkillLevelScore(employeeSkill.level, requiredSkill.level);
        const experienceBonus = Math.min(20, employeeSkill.yearsOfExperience * 2);
        const skillScore = levelScore + experienceBonus;
        
        weightedSkillScore += skillScore * requiredSkill.weight;
        totalWeight += requiredSkill.weight;
        
        if (requiredSkill.mandatory) {
          mandatorySkillsMatched++;
        }
        
        reasons.push({
          category: 'skills',
          description: `Has ${employeeSkill.level} level in ${requiredSkill.name} (${employeeSkill.yearsOfExperience} years exp)`,
          impact: skillScore,
          weight: requiredSkill.weight
        });
      } else if (requiredSkill.mandatory) {
        reasons.push({
          category: 'skills',
          description: `Missing mandatory skill: ${requiredSkill.name}`,
          impact: -30,
          weight: requiredSkill.weight
        });
      }
    }

    // If missing mandatory skills, heavily penalize
    if (totalMandatorySkills > 0 && mandatorySkillsMatched < totalMandatorySkills) {
      score = 0;
    } else {
      score = totalWeight > 0 ? (weightedSkillScore / totalWeight) : 0;
    }

    return { score: Math.max(0, Math.min(100, score)), reasons };
  }

  private static getSkillLevelScore(employeeLevel: string, requiredLevel: string): number {
    const levels = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
    const empLevel = levels[employeeLevel as keyof typeof levels] || 1;
    const reqLevel = levels[requiredLevel as keyof typeof levels] || 1;
    
    if (empLevel >= reqLevel) {
      return 70 + (empLevel - reqLevel) * 10; // 70-100 range
    } else {
      return Math.max(0, 40 - (reqLevel - empLevel) * 15); // Penalty for lower level
    }
  }

  private static calculateAvailabilityMatch(task: Task, employee: Employee) {
    let score = 0;
    const reasons: MatchingReason[] = [];

    if (!employee.availability.available) {
      return {
        score: 0,
        reasons: [{
          category: 'availability',
          description: 'Employee is not currently available',
          impact: -100,
          weight: 1
        }]
      };
    }

    // Capacity check
    const availableCapacity = employee.availability.capacity;
    score += Math.min(50, availableCapacity);
    
    reasons.push({
      category: 'availability',
      description: `Has ${availableCapacity}% capacity available`,
      impact: availableCapacity,
      weight: 1
    });

    // Workload analysis
    const currentWorkload = employee.workload || 0;
    const workloadScore = Math.max(0, 100 - currentWorkload);
    score += workloadScore * 0.5;
    
    reasons.push({
      category: 'workload',
      description: `Current workload: ${currentWorkload}%`,
      impact: workloadScore,
      weight: 0.5
    });

    // Time availability
    const scheduledHours = employee.availability.scheduledHours || 0;
    const maxHours = employee.availability.maxHoursPerWeek || 40;
    const availableHours = maxHours - scheduledHours;
    
    if (task.estimatedHours <= availableHours) {
      score += 20;
      reasons.push({
        category: 'availability',
        description: `Has ${availableHours}h available vs ${task.estimatedHours}h needed`,
        impact: 20,
        weight: 1
      });
    } else {
      reasons.push({
        category: 'availability',
        description: `Insufficient time: needs ${task.estimatedHours}h but only has ${availableHours}h available`,
        impact: -20,
        weight: 1
      });
    }

    return { score: Math.max(0, Math.min(100, score)), reasons };
  }

  private static calculateLocationMatch(task: Task, employee: Employee) {
    let score = 50;
    const reasons: MatchingReason[] = [];

    if (task.remoteAllowed) {
      score = 100;
      reasons.push({
        category: 'location',
        description: 'Task allows remote work',
        impact: 50,
        weight: 1
      });
    } else if (task.location === employee.location) {
      score = 100;
      reasons.push({
        category: 'location',
        description: 'Same location as task requirement',
        impact: 50,
        weight: 1
      });
    } else if (task.location && employee.location) {
      score = 30;
      reasons.push({
        category: 'location',
        description: `Different location: task in ${task.location}, employee in ${employee.location}`,
        impact: -20,
        weight: 1
      });
    }

    return { score, reasons };
  }

  private static async calculateExperienceMatch(task: Task, employee: Employee, session: neo4j.Session) {
    let score = 50;
    const reasons: MatchingReason[] = [];

    try {
      const performanceQuery = `
        MATCH (e:Employee {id: $employeeId})-[:ASSIGNED_TO]->(t:Task)
        WHERE t.status = 'completed'
        AND any(skill IN $taskSkills WHERE skill IN [rs.name FOR rs IN t.requiredSkills])
        RETURN 
          avg(t.performanceRating) as avgRating,
          count(t) as completedTasks,
          avg(t.actualHours) as avgHours
        LIMIT 1
      `;

      const result = await session.run(performanceQuery, {
        employeeId: employee.id,
        taskSkills: task.requiredSkills.map(s => s.name)
      });

      if (result.records.length > 0 && result.records[0].get('completedTasks') > 0) {
        const record = result.records[0];
        const avgRating = record.get('avgRating')?.toNumber() || 3;
        const completedTasks = record.get('completedTasks')?.toNumber() || 0;
        const avgHours = record.get('avgHours')?.toNumber() || task.estimatedHours;

        const ratingScore = (avgRating / 5) * 40;
        score += ratingScore;

        const experienceScore = Math.min(30, completedTasks * 3);
        score += experienceScore;

        if (avgHours < task.estimatedHours) {
          score += 20;
          reasons.push({
            category: 'performance',
            description: `Historically completes similar tasks faster (${avgHours.toFixed(1)}h avg vs ${task.estimatedHours}h estimated)`,
            impact: 20,
            weight: 1
          });
        }

        reasons.push({
          category: 'experience',
          description: `Completed ${completedTasks} similar tasks with ${avgRating.toFixed(1)}/5 rating`,
          impact: ratingScore + experienceScore,
          weight: 1
        });
      } else {
        const generalRating = employee.performanceRating || 3;
        const ratingScore = (generalRating / 5) * 30;
        score += ratingScore;

        reasons.push({
          category: 'performance',
          description: `General performance rating: ${generalRating}/5 (no specific task history)`,
          impact: ratingScore,
          weight: 1
        });
      }
    } catch (error) {
      logger.warn('Error calculating experience match:', error);
      reasons.push({
        category: 'experience',
        description: 'Unable to calculate experience metrics',
        impact: 0,
        weight: 1
      });
    }

    return { score: Math.max(0, Math.min(100, score)), reasons };
  }

  private static assessRisks(task: Task, employee: Employee): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Workload risk
    if (employee.workload > 80) {
      risks.push({
        type: 'overload',
        severity: 'high',
        description: `Employee already at ${employee.workload}% capacity`,
        mitigation: 'Consider redistributing current tasks or extending deadline'
      });
    } else if (employee.workload > 60) {
      risks.push({
        type: 'overload',
        severity: 'medium',
        description: `Employee at ${employee.workload}% capacity`,
        mitigation: 'Monitor workload closely'
      });
    }

    // Skill gap risk
    const mandatorySkills = task.requiredSkills.filter(rs => rs.mandatory);
    const employeeSkillNames = employee.skills.map(s => s.name);
    const missingMandatorySkills = mandatorySkills.filter(rs => !employeeSkillNames.includes(rs.name));

    if (missingMandatorySkills.length > 0) {
      risks.push({
        type: 'skill_gap',
        severity: 'high',
        description: `Missing mandatory skills: ${missingMandatorySkills.map(s => s.name).join(', ')}`,
        mitigation: 'Provide training or pair with experienced team member'
      });
    }

    // Timeline risk
    if (task.deadline) {
      const now = new Date();
      const timeAvailable = task.deadline.getTime() - now.getTime();
      const timeNeeded = task.estimatedHours * 60 * 60 * 1000;

      if (timeNeeded > timeAvailable) {
        risks.push({
          type: 'timeline',
          severity: 'high',
          description: 'Insufficient time to complete task by deadline',
          mitigation: 'Extend deadline or reduce task scope'
        });
      }
    }

    // Performance risk
    if (employee.performanceRating < 3) {
      risks.push({
        type: 'performance',
        severity: 'medium',
        description: `Below average performance rating: ${employee.performanceRating}/5`,
        mitigation: 'Provide additional support and monitoring'
      });
    }

    return risks;
  }

  private static calculateConfidence(employee: Employee, risks: RiskFactor[]): number {
    let confidence = 0.8;

    if (employee.skills.length > 0) confidence += 0.1;
    if (employee.performanceRating > 0) confidence += 0.1;

    const highRisks = risks.filter(r => r.severity === 'high').length;
    const mediumRisks = risks.filter(r => r.severity === 'medium').length;

    confidence -= (highRisks * 0.2) + (mediumRisks * 0.1);

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private static estimateCompletionTime(task: Task, employee: Employee): number {
    let baseTime = task.estimatedHours;

    const relevantSkills = employee.skills.filter(es => 
      task.requiredSkills.some(rs => rs.name === es.name)
    );

    if (relevantSkills.length > 0) {
      const avgSkillLevel = relevantSkills.reduce((sum, skill) => {
        const levels = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
        return sum + (levels[skill.level as keyof typeof levels] || 1);
      }, 0) / relevantSkills.length;

      const skillMultiplier = Math.max(0.7, 1.3 - (avgSkillLevel * 0.15));
      baseTime *= skillMultiplier;
    }

    if (employee.workload > 70) {
      baseTime *= 1.2;
    }

    return Math.round(baseTime * 10) / 10;
  }

  private static calculateRecommendedStartDate(employee: Employee): Date {
    const now = new Date();
    
    if (employee.workload > 80) {
      now.setDate(now.getDate() + 3);
    } else if (employee.workload > 60) {
      now.setDate(now.getDate() + 1);
    }

    return now;
  }
}
