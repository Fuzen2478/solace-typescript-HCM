/**
 * HCM 프로젝트 통합 테스트 스위트
 * 전체 시스템의 통합 기능을 검증합니다.
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const WebSocket = require('ws');

// 테스트 설정
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  retryAttempts: 3,
  concurrentUsers: 50,
  testDataSize: 100
};

// 색상 출력을 위한 ANSI 코드
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class TestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      startTime: Date.now(),
      tests: []
    };
  }

  // 로그 출력 헬퍼
  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  // 테스트 결과 기록
  recordTest(name, status, duration, error = null) {
    this.results.total++;
    this.results[status]++;
    this.results.tests.push({
      name,
      status,
      duration,
      error: error?.message || null,
      timestamp: new Date().toISOString()
    });

    const statusColor = status === 'passed' ? 'green' : status === 'failed' ? 'red' : 'yellow';
    const statusSymbol = status === 'passed' ? '✓' : status === 'failed' ? '✗' : '⚠';
    this.log(`  ${statusSymbol} ${name} (${duration}ms)`, statusColor);
    
    if (error) {
      this.log(`    Error: ${error.message}`, 'red');
    }
  }

  // HTTP 요청 헬퍼
  async makeRequest(method, endpoint, data = null, expectedStatus = 200) {
    const startTime = performance.now();
    try {
      const config = {
        method,
        url: `${TEST_CONFIG.baseUrl}${endpoint}`,
        timeout: TEST_CONFIG.timeout,
        validateStatus: (status) => status === expectedStatus
      };

      if (data) {
        config.data = data;
        config.headers = { 'Content-Type': 'application/json' };
      }

      const response = await axios(config);
      const duration = Math.round(performance.now() - startTime);
      
      return { response, duration };
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      throw { error, duration };
    }
  }

  // 서비스 상태 확인
  async testServiceHealth() {
    this.log('\n🏥 서비스 상태 확인 테스트', 'cyan');
    
    const services = [
      { name: 'API Gateway', endpoint: '/api/health' },
      { name: 'Matching Engine', endpoint: '/api/matching/health' },
      { name: 'Resource Service', endpoint: '/api/resources/health' },
      { name: 'Validator Service', endpoint: '/api/validator/health' },
      { name: 'Edge Agent', endpoint: '/api/edge/health' },
      { name: 'Outsourcing Service', endpoint: '/api/outsourcing/health' }
    ];

    for (const service of services) {
      const testName = `${service.name} Health Check`;
      const startTime = performance.now();
      
      try {
        const { response, duration } = await this.makeRequest('GET', service.endpoint);
        
        if (response.data && response.data.status === 'healthy') {
          this.recordTest(testName, 'passed', duration);
        } else {
          throw new Error(`Unhealthy response: ${JSON.stringify(response.data)}`);
        }
      } catch ({ error, duration }) {
        this.recordTest(testName, 'failed', duration || Math.round(performance.now() - startTime), error);
      }
    }
  }

  // 기본 워크플로우 테스트
  async testBasicWorkflow() {
    this.log('\n🔄 기본 워크플로우 테스트', 'cyan');

    // 1. 인력 등록 테스트
    const testName1 = 'Resource Registration';
    const startTime1 = performance.now();
    
    try {
      const resourceData = {
        id: `test-resource-${Date.now()}`,
        name: 'John Doe',
        skills: ['React', 'Node.js', 'TypeScript'],
        experience: 5,
        availability: 'available',
        hourlyRate: 50,
        location: 'Seoul, Korea'
      };

      const { response: registerResponse, duration: registerDuration } = await this.makeRequest(
        'POST', 
        '/api/resources/register', 
        resourceData,
        201
      );

      this.recordTest(testName1, 'passed', registerDuration);

      // 2. 프로젝트 매칭 요청 테스트
      const testName2 = 'Project Matching Request';

      const projectData = {
        id: `test-project-${Date.now()}`,
        title: 'React Dashboard Development',
        requiredSkills: ['React', 'TypeScript'],
        duration: '3 months',
        budget: 15000,
        urgency: 'high'
      };

      const { response: matchResponse, duration: matchDuration } = await this.makeRequest(
        'POST',
        '/api/matching/find',
        projectData,
        200
      );

      if (matchResponse.data && matchResponse.data.matches && matchResponse.data.matches.length > 0) {
        this.recordTest(testName2, 'passed', matchDuration);
      } else {
        throw new Error('No matches found');
      }

      // 3. 계약 생성 테스트
      const testName3 = 'Contract Creation';

      const contractData = {
        resourceId: resourceData.id,
        projectId: projectData.id,
        terms: {
          duration: '3 months',
          rate: 50,
          startDate: new Date().toISOString()
        }
      };

      const { response: contractResponse, duration: contractDuration } = await this.makeRequest(
        'POST',
        '/api/contracts/create',
        contractData,
        201
      );

      this.recordTest(testName3, 'passed', contractDuration);

    } catch ({ error, duration }) {
      this.recordTest('Basic Workflow', 'failed', duration || Math.round(performance.now() - startTime1), error);
    }
  }

  // 매칭 엔진 정확도 테스트
  async testMatchingAccuracy() {
    this.log('\n🎯 매칭 엔진 정확도 테스트', 'cyan');

    const testCases = [
      {
        project: {
          requiredSkills: ['React', 'Node.js'],
          experience: 3,
          budget: 10000
        },
        expectedMinMatches: 2,
        expectedAccuracy: 0.85
      },
      {
        project: {
          requiredSkills: ['Python', 'Django', 'PostgreSQL'],
          experience: 5,
          budget: 20000
        },
        expectedMinMatches: 1,
        expectedAccuracy: 0.85
      }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const testName = `Matching Accuracy Test ${i + 1}`;
      const startTime = performance.now();

      try {
        const { response, duration } = await this.makeRequest(
          'POST',
          '/api/matching/analyze',
          testCase.project,
          200
        );

        const { matches, accuracy } = response.data;

        if (matches.length >= testCase.expectedMinMatches && accuracy >= testCase.expectedAccuracy) {
          this.recordTest(testName, 'passed', duration);
        } else {
          throw new Error(`Expected ${testCase.expectedMinMatches} matches with ${testCase.expectedAccuracy} accuracy, got ${matches.length} matches with ${accuracy} accuracy`);
        }

      } catch ({ error, duration }) {
        this.recordTest(testName, 'failed', duration || Math.round(performance.now() - startTime), error);
      }
    }
  }

  // 성능 테스트
  async testPerformance() {
    this.log('\n⚡ 성능 테스트', 'cyan');

    // 동시 요청 처리 능력 테스트
    const testName1 = 'Concurrent Request Handling';
    const startTime1 = performance.now();

    try {
      const requests = [];
      const numRequests = 20;

      for (let i = 0; i < numRequests; i++) {
        requests.push(
          this.makeRequest('GET', '/api/resources', null, 200)
        );
      }

      const results = await Promise.allSettled(requests);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const duration = Math.round(performance.now() - startTime1);

      if (successCount >= numRequests * 0.95) { // 95% 성공률
        this.recordTest(testName1, 'passed', duration);
      } else {
        throw new Error(`Only ${successCount}/${numRequests} requests succeeded`);
      }

    } catch (error) {
      this.recordTest(testName1, 'failed', Math.round(performance.now() - startTime1), error);
    }

    // 응답 시간 테스트
    const testName2 = 'Response Time Performance';
    const startTime2 = performance.now();

    try {
      const { response, duration } = await this.makeRequest('GET', '/api/matching/performance-test', null, 200);

      if (duration < 3000) { // 3초 이내
        this.recordTest(testName2, 'passed', duration);
      } else {
        throw new Error(`Response time ${duration}ms exceeds 3000ms threshold`);
      }

    } catch ({ error, duration }) {
      this.recordTest(testName2, 'failed', duration || Math.round(performance.now() - startTime2), error);
    }
  }

  // 블록체인 통합 테스트
  async testBlockchainIntegration() {
    this.log('\n⛓️ 블록체인 통합 테스트', 'cyan');

    const testName1 = 'Smart Contract Deployment';
    const startTime1 = performance.now();

    try {
      const { response, duration } = await this.makeRequest(
        'POST',
        '/api/blockchain/deploy-contract',
        { contractName: 'HCMContract', version: '1.0' },
        200
      );

      if (response.data && response.data.txId) {
        this.recordTest(testName1, 'passed', duration);
        
        // 트랜잭션 기록 테스트
        const testName2 = 'Transaction Recording';
        
        const transactionData = {
          type: 'contract_creation',
          resourceId: 'test-resource-001',
          projectId: 'test-project-001',
          terms: {
            duration: '3 months',
            rate: 50
          }
        };

        const { response: txResponse, duration: txDuration } = await this.makeRequest(
          'POST',
          '/api/blockchain/record-transaction',
          transactionData,
          201
        );

        if (txResponse.data && txResponse.data.blockHash) {
          this.recordTest(testName2, 'passed', txDuration);
        } else {
          throw new Error('Transaction recording failed');
        }

      } else {
        throw new Error('Contract deployment failed');
      }

    } catch ({ error, duration }) {
      this.recordTest(testName1, 'failed', duration || Math.round(performance.now() - startTime1), error);
    }
  }

  // 메인 테스트 실행
  async runAllTests() {
    this.log('🚀 HCM 프로젝트 통합 테스트 시작', 'bold');
    this.log(`⏰ 시작 시간: ${new Date().toLocaleString('ko-KR')}`);
    this.log('='.repeat(60));

    try {
      // 기본 테스트들
      await this.testServiceHealth();
      await this.testBasicWorkflow();
      await this.testMatchingAccuracy();
      await this.testPerformance();
      await this.testBlockchainIntegration();
      
    } catch (error) {
      this.log(`\n💥 예상치 못한 오류 발생: ${error.message}`, 'red');
    }

    return this.generateReport();
  }

  // 최종 리포트 생성
  generateReport() {
    const totalDuration = Date.now() - this.results.startTime;
    const successRate = this.results.total > 0 ? ((this.results.passed / this.results.total) * 100).toFixed(2) : 0;

    this.log('\n' + '='.repeat(60), 'bold');
    this.log('📋 통합 테스트 결과 리포트', 'bold');
    this.log('='.repeat(60), 'bold');
    
    this.log(`\n📊 전체 통계:`);
    this.log(`  • 총 테스트: ${this.results.total}`);
    this.log(`  • 성공: ${this.results.passed}`, 'green');
    this.log(`  • 실패: ${this.results.failed}`, 'red');
    this.log(`  • 건너뛴: ${this.results.skipped}`, 'yellow');
    this.log(`  • 성공률: ${successRate}%`, successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red');
    this.log(`  • 총 실행 시간: ${Math.round(totalDuration / 1000)}초`);

    if (this.results.failed > 0) {
      this.log('\n❌ 실패한 테스트:', 'red');
      this.results.tests
        .filter(test => test.status === 'failed')
        .forEach(test => {
          this.log(`  • ${test.name}: ${test.error}`, 'red');
        });
    }

    // 권장사항
    this.log('\n💡 권장사항:');
    if (this.results.failed === 0) {
      this.log('  ✅ 모든 테스트가 통과했습니다. 프로덕션 배포 준비가 완료되었습니다.', 'green');
    } else if (successRate >= 90) {
      this.log('  ⚠️  일부 테스트가 실패했지만 대부분 정상입니다. 실패한 테스트를 검토해주세요.', 'yellow');
    } else {
      this.log('  🚨 많은 테스트가 실패했습니다. 시스템 점검이 필요합니다.', 'red');
    }

    this.log('\n' + '='.repeat(60), 'bold');
    
    return {
      success: this.results.failed === 0,
      summary: this.results
    };
  }
}

// 테스트 실행부
if (require.main === module) {
  const runner = new TestRunner();
  
  runner.runAllTests()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('테스트 실행 중 오류:', error);
      process.exit(1);
    });
}

module.exports = TestRunner;
