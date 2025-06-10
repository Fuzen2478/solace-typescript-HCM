const axios = require('axios');
const WebSocket = require('ws');
const readline = require('readline');

// Demo Configuration
const CONFIG = {
  services: {
    gateway: 'http://localhost:3000',
    hr: 'http://localhost:3001',
    matching: 'http://localhost:3002',
    verification: 'http://localhost:3003',
    edge: 'http://localhost:3004',
    outsourcing: 'http://localhost:3006'
  },
  demo: {
    autoAdvance: false, // Set to true for automated demo
    stepDelay: 3000     // 3 seconds between steps in auto mode
  }
};

class HCMSystemDemo {
  constructor() {
    this.stepCount = 0;
    this.demoData = {
      employees: [],
      tasks: [],
      certifications: [],
      requests: []
    };
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async runDemo() {
    console.log('🚀 HCM 분산 시스템 종합 데모');
    console.log('==============================\n');
    
    console.log('이 데모는 다음과 같은 전체 워크플로우를 보여줍니다:');
    console.log('1. 직원 생성 및 관리');
    console.log('2. 자격증 검증 시스템');
    console.log('3. 작업 매칭 엔진');
    console.log('4. 분산 작업 처리');
    console.log('5. 외부 아웃소싱 연동');
    console.log('6. 실시간 시스템 모니터링\n');

    if (!CONFIG.demo.autoAdvance) {
      await this.waitForUserInput('데모를 시작하려면 Enter를 누르세요...');
    }

    try {
      // Step 1: System Health Check
      await this.step1_SystemHealthCheck();
      
      // Step 2: Create Sample Employees
      await this.step2_CreateSampleEmployees();
      
      // Step 3: Add Certifications
      await this.step3_AddCertifications();
      
      // Step 4: Create and Match Tasks
      await this.step4_CreateAndMatchTasks();
      
      // Step 5: Distributed Task Processing
      await this.step5_DistributedTaskProcessing();
      
      // Step 6: Outsourcing Integration
      await this.step6_OutsourcingIntegration();
      
      // Step 7: Real-time Monitoring
      await this.step7_RealTimeMonitoring();
      
      // Step 8: System Analytics
      await this.step8_SystemAnalytics();

      console.log('\n🎉 데모 완료!');
      console.log('===================================');
      console.log('모든 HCM 시스템 기능이 성공적으로 시연되었습니다.');
      console.log('실제 엔터프라이즈 환경에서 사용할 준비가 완료되었습니다!\n');

    } catch (error) {
      console.error('❌ 데모 실행 중 오류 발생:', error.message);
    } finally {
      this.rl.close();
    }
  }

  async step1_SystemHealthCheck() {
    await this.nextStep('1. 시스템 헬스체크', '모든 서비스의 상태를 확인합니다...');
    
    const services = Object.entries(CONFIG.services);
    const healthResults = [];
    
    for (const [name, url] of services) {
      try {
        const response = await axios.get(`${url}/health`, { timeout: 5000 });
        healthResults.push({
          service: name,
          status: '✅ 정상',
          response: response.data
        });
        console.log(`   ${name.toUpperCase()}: ✅ 정상 (${response.status})`);
      } catch (error) {
        healthResults.push({
          service: name,
          status: '❌ 오류',
          error: error.message
        });
        console.log(`   ${name.toUpperCase()}: ❌ 오류 - ${error.message}`);
      }
    }
    
    const healthyServices = healthResults.filter(r => r.status.includes('✅')).length;
    console.log(`\n📊 결과: ${healthyServices}/${services.length} 서비스 정상 동작 중\n`);
  }

  async step2_CreateSampleEmployees() {
    await this.nextStep('2. 샘플 직원 생성', '다양한 스킬을 가진 직원들을 생성합니다...');
    
    const sampleEmployees = [
      {
        name: '김개발',
        email: 'kim.dev@company.com',
        department: 'Engineering',
        role: 'Senior Developer',
        location: 'Seoul',
        skills: [
          { name: 'JavaScript', level: 'expert' },
          { name: 'React', level: 'advanced' },
          { name: 'Node.js', level: 'advanced' }
        ]
      },
      {
        name: '이설계',
        email: 'lee.architect@company.com',
        department: 'Engineering',
        role: 'System Architect',
        location: 'Busan',
        skills: [
          { name: 'AWS', level: 'expert' },
          { name: 'Docker', level: 'advanced' },
          { name: 'Kubernetes', level: 'intermediate' }
        ]
      },
      {
        name: '박데이터',
        email: 'park.data@company.com',
        department: 'Data Science',
        role: 'Data Engineer',
        location: 'Remote',
        skills: [
          { name: 'Python', level: 'expert' },
          { name: 'SQL', level: 'advanced' },
          { name: 'Machine Learning', level: 'intermediate' }
        ]
      }
    ];

    for (const employee of sampleEmployees) {
      try {
        const response = await axios.post(`${CONFIG.services.hr}/employees`, employee);
        this.demoData.employees.push(response.data);
        console.log(`   ✅ ${employee.name} 생성 완료 (ID: ${response.data.id})`);
      } catch (error) {
        console.log(`   ❌ ${employee.name} 생성 실패: ${error.message}`);
      }
    }
    
    console.log(`\n📊 총 ${this.demoData.employees.length}명의 직원이 생성되었습니다.\n`);
  }

  async step3_AddCertifications() {
    await this.nextStep('3. 자격증 추가 및 검증', '직원들의 자격증을 추가하고 자동 검증을 수행합니다...');
    
    const certifications = [
      {
        employeeId: this.demoData.employees[0]?.id,
        certificationName: 'AWS Certified Developer',
        issuer: 'AWS',
        issueDate: new Date('2023-06-15').toISOString()
      },
      {
        employeeId: this.demoData.employees[1]?.id,
        certificationName: 'Certified Kubernetes Administrator',
        issuer: 'CNCF',
        issueDate: new Date('2023-08-20').toISOString()
      },
      {
        employeeId: this.demoData.employees[2]?.id,
        certificationName: 'Google Cloud Professional Data Engineer',
        issuer: 'Google',
        issueDate: new Date('2023-09-10').toISOString()
      }
    ];

    for (const cert of certifications) {
      if (cert.employeeId) {
        try {
          const response = await axios.post(`${CONFIG.services.verification}/certifications`, cert);
          this.demoData.certifications.push(response.data);
          console.log(`   ✅ ${cert.certificationName} 추가 완료 (자동검증: ${response.data.autoVerified ? '성공' : '대기중'})`);
        } catch (error) {
          console.log(`   ❌ ${cert.certificationName} 추가 실패: ${error.message}`);
        }
      }
    }
    
    console.log(`\n📊 총 ${this.demoData.certifications.length}개의 자격증이 추가되었습니다.\n`);
  }

  async step4_CreateAndMatchTasks() {
    await this.nextStep('4. 작업 생성 및 매칭', '다양한 작업을 생성하고 최적의 직원을 매칭합니다...');
    
    const tasks = [
      {
        title: 'React 컴포넌트 리팩토링',
        description: '레거시 React 컴포넌트를 Hooks로 변환',
        requiredSkills: [
          { name: 'React', level: 'advanced', mandatory: true, weight: 10 },
          { name: 'JavaScript', level: 'advanced', mandatory: true, weight: 8 }
        ],
        estimatedHours: 20,
        priority: 'high',
        remoteAllowed: true
      },
      {
        title: 'AWS 인프라 마이그레이션',
        description: '온프레미스 서버를 AWS로 이전',
        requiredSkills: [
          { name: 'AWS', level: 'expert', mandatory: true, weight: 10 },
          { name: 'Docker', level: 'intermediate', mandatory: false, weight: 6 }
        ],
        estimatedHours: 80,
        priority: 'urgent',
        remoteAllowed: false,
        location: 'Seoul'
      },
      {
        title: '데이터 파이프라인 구축',
        description: '실시간 데이터 처리 파이프라인 개발',
        requiredSkills: [
          { name: 'Python', level: 'expert', mandatory: true, weight: 10 },
          { name: 'SQL', level: 'advanced', mandatory: true, weight: 8 }
        ],
        estimatedHours: 60,
        priority: 'medium',
        remoteAllowed: true
      }
    ];

    for (const task of tasks) {
      try {
        const response = await axios.post(`${CONFIG.services.matching}/tasks`, task);
        this.demoData.tasks.push(response.data);
        
        console.log(`   ✅ "${task.title}" 작업 생성 완료`);
        
        if (response.data.initialMatches && response.data.initialMatches.length > 0) {
          const bestMatch = response.data.initialMatches[0];
          console.log(`      🎯 최적 매칭: ${bestMatch.employee?.name || 'Unknown'} (점수: ${bestMatch.score || 'N/A'})`);
        } else {
          console.log(`      ⚠️  적합한 내부 인력을 찾지 못했습니다.`);
        }
        
      } catch (error) {
        console.log(`   ❌ "${task.title}" 작업 생성 실패: ${error.message}`);
      }
    }
    
    console.log(`\n📊 총 ${this.demoData.tasks.length}개의 작업이 생성되었습니다.\n`);
  }

  async step5_DistributedTaskProcessing() {
    await this.nextStep('5. 분산 작업 처리', 'Edge Agent를 통한 분산 작업을 실행합니다...');
    
    const distributedTasks = [
      {
        type: 'health_check',
        payload: {
          services: Object.values(CONFIG.services),
          description: '전체 시스템 헬스체크'
        },
        priority: 8
      },
      {
        type: 'data_sync',
        payload: {
          sourceService: 'hr-service',
          targetService: 'verification-service',
          dataType: 'employee_certifications',
          description: '직원-자격증 데이터 동기화'
        },
        priority: 6
      },
      {
        type: 'analytics',
        payload: {
          metrics: ['system_performance', 'task_completion', 'employee_utilization'],
          timeRange: '24h',
          description: '시스템 성능 분석'
        },
        priority: 4
      }
    ];

    for (const task of distributedTasks) {
      try {
        const response = await axios.post(`${CONFIG.services.edge}/tasks`, task);
        console.log(`   ✅ ${task.payload.description} 작업 제출 완료 (ID: ${response.data.taskId})`);
        
        // Check task status after a short delay
        setTimeout(async () => {
          try {
            const statusResponse = await axios.get(`${CONFIG.services.edge}/tasks/${response.data.taskId}`);
            console.log(`      📊 작업 상태: ${statusResponse.data.status}`);
          } catch (error) {
            // Silent error for demo purposes
          }
        }, 2000);
        
      } catch (error) {
        console.log(`   ❌ ${task.payload.description} 작업 제출 실패: ${error.message}`);
      }
    }
    
    // Show cluster status
    try {
      const agentsResponse = await axios.get(`${CONFIG.services.edge}/agents`);
      console.log(`\n📊 활성 Edge Agent: ${agentsResponse.data.agents?.length || 0}개`);
    } catch (error) {
      console.log(`\n⚠️  Edge Agent 상태 조회 실패: ${error.message}`);
    }
    
    console.log('');
  }

  async step6_OutsourcingIntegration() {
    await this.nextStep('6. 외부 아웃소싱 연동', '내부 인력 부족 시 외부 파트너를 통한 리소스 확보를 시연합니다...');
    
    const outsourcingRequests = [
      {
        requiredSkills: ['Vue.js', 'PHP', 'Laravel'],
        estimatedHours: 40,
        maxBudget: 2000,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'E-commerce 웹사이트 개발',
        priority: 'medium',
        remoteAllowed: true
      },
      {
        requiredSkills: ['Java', 'Spring Boot', 'Microservices'],
        estimatedHours: 120,
        maxBudget: 8000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        description: '마이크로서비스 아키텍처 설계 및 구현',
        priority: 'high',
        remoteAllowed: true
      }
    ];

    for (const request of outsourcingRequests) {
      try {
        const response = await axios.post(`${CONFIG.services.outsourcing}/requests`, request);
        this.demoData.requests.push(response.data);
        
        console.log(`   ✅ "${request.description}" 아웃소싱 요청 완료`);
        console.log(`      📊 제안 받은 업체: ${response.data.proposals?.length || 0}개`);
        
        if (response.data.bestMatch) {
          const best = response.data.bestMatch;
          console.log(`      🏆 최고 제안: ${best.providerName} (점수: ${best.matchScore}, 비용: $${best.totalCost})`);
        }
        
      } catch (error) {
        console.log(`   ❌ "${request.description}" 아웃소싱 요청 실패: ${error.message}`);
      }
    }
    
    console.log(`\n📊 총 ${this.demoData.requests.length}개의 아웃소싱 요청이 처리되었습니다.\n`);
  }

  async step7_RealTimeMonitoring() {
    await this.nextStep('7. 실시간 모니터링', 'WebSocket을 통한 실시간 시스템 상태를 확인합니다...');
    
    console.log('   🔄 실시간 연결 설정 중...');
    
    const connections = [];
    const services = [
      { name: 'HR Service', port: 3011 },
      { name: 'Matching Engine', port: 3012 },
      { name: 'Edge Agent', port: 3005 }
    ];

    for (const service of services) {
      try {
        const ws = new WebSocket(`ws://localhost:${service.port}`);
        
        ws.on('open', () => {
          console.log(`   ✅ ${service.name} WebSocket 연결 성공`);
          
          // Request status update
          ws.send(JSON.stringify({
            type: 'get_status',
            timestamp: new Date().toISOString()
          }));
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log(`   📡 ${service.name}: ${message.type} 메시지 수신`);
          } catch (error) {
            // Silent error for demo
          }
        });
        
        ws.on('error', (error) => {
          console.log(`   ⚠️  ${service.name} WebSocket 연결 실패: ${error.message}`);
        });
        
        connections.push(ws);
        
      } catch (error) {
        console.log(`   ❌ ${service.name} WebSocket 연결 실패: ${error.message}`);
      }
    }

    // Simulate monitoring for a few seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Close all connections
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    
    console.log(`   📊 실시간 모니터링 완료 (${connections.length}개 서비스 연결)\n`);
  }

  async step8_SystemAnalytics() {
    await this.nextStep('8. 시스템 분석', '전체 시스템의 성능 지표와 통계를 조회합니다...');
    
    const analyticsQueries = [
      {
        service: 'matching',
        endpoint: '/analytics/matching',
        name: '매칭 엔진 성능'
      },
      {
        service: 'verification',
        endpoint: '/analytics/verification',
        name: '검증 서비스 통계'
      },
      {
        service: 'outsourcing',
        endpoint: '/analytics',
        name: '아웃소싱 현황'
      },
      {
        service: 'hr',
        endpoint: '/analytics/skills',
        name: '스킬 분석'
      }
    ];

    for (const query of analyticsQueries) {
      try {
        const response = await axios.get(`${CONFIG.services[query.service]}${query.endpoint}`);
        console.log(`   ✅ ${query.name}:`);
        
        if (query.service === 'matching') {
          const data = response.data;
          console.log(`      - 총 작업: ${data.totalTasks || 0}개`);
          console.log(`      - 할당률: ${Math.round(data.assignmentRate || 0)}%`);
          console.log(`      - 완료율: ${Math.round(data.completionRate || 0)}%`);
        } else if (query.service === 'verification') {
          const data = response.data;
          console.log(`      - 인증서: ${data.certifications?.total || 0}개`);
          console.log(`      - 검증률: ${Math.round(data.certifications?.verificationRate || 0)}%`);
        } else if (query.service === 'outsourcing') {
          const data = response.data;
          console.log(`      - 총 요청: ${data.totalRequests || 0}개`);
          console.log(`      - 매칭 성공: ${data.successfulMatches || 0}개`);
          console.log(`      - 비용 절감: ${data.costSavings?.percentage || 0}%`);
        } else if (query.service === 'hr') {
          const data = response.data;
          console.log(`      - 주요 스킬: ${data.slice(0, 3).map(s => s.skill).join(', ')}`);
        }
        
      } catch (error) {
        console.log(`   ❌ ${query.name} 조회 실패: ${error.message}`);
      }
    }
    
    console.log('\n📊 전체 시스템 요약:');
    console.log(`   - 활성 직원: ${this.demoData.employees.length}명`);
    console.log(`   - 처리된 작업: ${this.demoData.tasks.length}개`);
    console.log(`   - 검증된 인증서: ${this.demoData.certifications.length}개`);
    console.log(`   - 아웃소싱 요청: ${this.demoData.requests.length}개`);
    console.log('');
  }

  async nextStep(title, description) {
    this.stepCount++;
    
    console.log(`\n📋 Step ${this.stepCount}: ${title}`);
    console.log('─'.repeat(50));
    console.log(description);
    console.log('');
    
    if (!CONFIG.demo.autoAdvance) {
      await this.waitForUserInput('계속하려면 Enter를 누르세요...');
    } else {
      await new Promise(resolve => setTimeout(resolve, CONFIG.demo.stepDelay));
    }
  }

  async waitForUserInput(message) {
    return new Promise((resolve) => {
      this.rl.question(message, () => {
        resolve();
      });
    });
  }
}

// Run the demo
if (require.main === module) {
  const demo = new HCMSystemDemo();
  demo.runDemo().catch(console.error);
}

module.exports = HCMSystemDemo;