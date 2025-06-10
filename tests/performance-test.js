/**
 * HCM 프로젝트 성능 및 부하 테스트
 * 시스템의 성능 한계와 확장성을 검증합니다.
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const EventEmitter = require('events');

class PerformanceTester extends EventEmitter {
  constructor() {
    super();
    this.baseUrl = 'http://localhost:3000';
    this.metrics = {
      requests: [],
      errors: [],
      responseTimeStats: {},
      throughputStats: {},
      resourceUsage: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '📊';
    console.log(`${timestamp} ${emoji} ${message}`);
  }

  // HTTP 요청 메트릭 수집
  async makeRequestWithMetrics(method, endpoint, data = null, label = 'default') {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        timeout: 30000,
        data
      };

      const response = await axios(config);
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      const endMemory = process.memoryUsage();

      // 메트릭 수집
      this.metrics.requests.push({
        label,
        method,
        endpoint,
        responseTime,
        statusCode: response.status,
        dataSize: JSON.stringify(response.data).length,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        timestamp: new Date().toISOString()
      });

      return { response, responseTime };

    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.metrics.errors.push({
        label,
        method,
        endpoint,
        error: error.message,
        responseTime,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  // 종합 성능 테스트 실행
  async runComprehensiveTest() {
    this.log('🏁 종합 성능 테스트 시작', 'info');
    this.log(`⏰ 시작 시간: ${new Date().toLocaleString('ko-KR')}`);
    this.log('='.repeat(80));

    const testResults = {};

    try {
      // 1. 응답 시간 테스트
      this.log('\n📏 1. 응답 시간 테스트');
      await this.testBasicResponseTime();

      // 2. 동시성 테스트
      this.log('\n🚀 2. 동시성 테스트');
      const concurrencyResult = await this.testBasicConcurrency();
      testResults.concurrency = concurrencyResult;

      // 3. 처리량 테스트  
      this.log('\n🏎️ 3. 처리량 테스트');
      const throughputResult = await this.testBasicThroughput();
      testResults.throughput = throughputResult;

    } catch (error) {
      this.log(`❌ 성능 테스트 중 오류: ${error.message}`, 'error');
    }

    this.generatePerformanceReport(testResults);
    return testResults;
  }

  // 기본 응답 시간 테스트
  async testBasicResponseTime() {
    this.log('📊 기본 엔드포인트 응답 시간 측정...');
    
    const endpoints = [
      '/api/health',
      '/api/resources/health',
      '/api/matching/health'
    ];

    for (const endpoint of endpoints) {
      const responseTimes = [];
      
      for (let i = 0; i < 10; i++) {
        try {
          const { responseTime } = await this.makeRequestWithMetrics('GET', endpoint, null, 'response_time_test');
          responseTimes.push(responseTime);
        } catch (error) {
          this.log(`⚠️ 요청 실패: ${endpoint}`, 'warning');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (responseTimes.length > 0) {
        const avg = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
        this.log(`  ✓ ${endpoint}: 평균 ${avg.toFixed(2)}ms`);
      }
    }
  }

  // 기본 동시성 테스트
  async testBasicConcurrency() {
    this.log('📊 동시 요청 처리 능력 테스트...');
    
    const concurrentUsers = 20;
    const requestsPerUser = 3;
    const promises = [];

    for (let i = 0; i < concurrentUsers; i++) {
      for (let j = 0; j < requestsPerUser; j++) {
        promises.push(
          this.makeRequestWithMetrics('GET', '/api/health', null, `concurrency_test_${i}_${j}`)
            .catch(() => ({ error: true }))
        );
      }
    }

    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled' && !r.value.error).length;
    const totalRequests = concurrentUsers * requestsPerUser;
    const successRate = (successCount / totalRequests) * 100;

    this.log(`  ✓ 총 ${totalRequests}개 요청 중 ${successCount}개 성공 (${successRate.toFixed(2)}%)`);

    return {
      totalRequests,
      successfulRequests: successCount,
      successRate
    };
  }

  // 기본 처리량 테스트
  async testBasicThroughput() {
    this.log('📊 시스템 처리량 측정...');
    
    const testDuration = 30000; // 30초
    const startTime = Date.now();
    let completedRequests = 0;
    let errors = 0;

    while (Date.now() - startTime < testDuration) {
      try {
        await this.makeRequestWithMetrics('GET', '/api/health', null, 'throughput_test');
        completedRequests++;
      } catch (error) {
        errors++;
      }
      
      // 부하 조절
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const actualDuration = (Date.now() - startTime) / 1000;
    const throughput = completedRequests / actualDuration;
    const errorRate = (errors / (completedRequests + errors)) * 100;

    this.log(`  ✓ 처리량: ${throughput.toFixed(2)} TPS, 오류율: ${errorRate.toFixed(2)}%`);

    return {
      completedRequests,
      errors,
      throughput,
      errorRate,
      duration: actualDuration
    };
  }

  // 성능 테스트 리포트 생성
  generatePerformanceReport(testResults) {
    this.log('\n' + '='.repeat(80));
    this.log('📊 종합 성능 테스트 리포트', 'info');
    this.log('='.repeat(80));

    // 동시성 테스트 결과
    if (testResults.concurrency) {
      this.log('\n🚀 동시성 테스트 결과:');
      const successRate = testResults.concurrency.successRate;
      const status = successRate > 95 ? '✅' : successRate > 85 ? '⚠️' : '❌';
      this.log(`  ${status} 성공률: ${successRate.toFixed(2)}%`);
      this.log(`  📊 처리된 요청: ${testResults.concurrency.successfulRequests}/${testResults.concurrency.totalRequests}`);
    }

    // 처리량 테스트 결과
    if (testResults.throughput) {
      this.log('\n🏎️ 처리량 테스트 결과:');
      const tps = testResults.throughput.throughput;
      const status = tps > 10 ? '✅' : tps > 5 ? '⚠️' : '❌';
      this.log(`  ${status} 처리량: ${tps.toFixed(2)} TPS`);
      this.log(`  📊 오류율: ${testResults.throughput.errorRate.toFixed(2)}%`);
    }

    // 전체 안정성 평가
    this.log('\n🛡️ 시스템 안정성 평가:');
    const overallErrors = this.metrics.errors.length;
    const totalRequests = this.metrics.requests.length;
    const overallErrorRate = totalRequests > 0 ? (overallErrors / totalRequests) * 100 : 0;
    
    if (overallErrorRate < 5) {
      this.log('  ✅ 우수: 시스템이 안정적으로 작동합니다', 'success');
    } else if (overallErrorRate < 15) {
      this.log('  ⚠️ 양호: 일부 개선이 필요합니다', 'warning');
    } else {
      this.log('  ❌ 개선 필요: 안정성 향상이 필요합니다', 'error');
    }
    
    this.log(`  📈 전체 오류율: ${overallErrorRate.toFixed(2)}%`);
    this.log(`  📊 총 처리 요청: ${totalRequests}`);

    // 권장사항
    this.log('\n💡 성능 최적화 권장사항:');
    
    if (testResults.throughput && testResults.throughput.throughput < 10) {
      this.log('  ⚡ 처리량 개선 방안:');
      this.log('    - 데이터베이스 쿼리 최적화');
      this.log('    - 캐싱 시스템 도입');
      this.log('    - 로드 밸런싱 구성');
    }
    
    if (overallErrorRate > 10) {
      this.log('  🔧 안정성 개선 방안:');
      this.log('    - 에러 핸들링 강화');
      this.log('    - 서킷 브레이커 패턴 적용');
      this.log('    - 모니터링 및 알림 시스템 구축');
    }

    if (overallErrorRate < 5 && testResults.throughput?.throughput > 10) {
      this.log('  🎉 시스템이 우수한 성능을 보이고 있습니다!');
      this.log('  🚀 프로덕션 배포 준비가 완료되었습니다.');
    }

    this.log('\n' + '='.repeat(80));
    this.log('🏆 성능 테스트 완료!');
    this.log('='.repeat(80));
  }
}

// 실행부
if (require.main === module) {
  const tester = new PerformanceTester();
  
  tester.runComprehensiveTest()
    .then(() => {
      const hasErrors = tester.metrics.errors.length > 0;
      const errorRate = tester.metrics.requests.length > 0 ? 
        (tester.metrics.errors.length / tester.metrics.requests.length) * 100 : 0;
      
      // 15% 이상 오류율이면 실패로 간주
      process.exit(errorRate > 15 ? 1 : 0);
    })
    .catch((error) => {
      console.error('성능 테스트 실행 중 오류:', error);
      process.exit(1);
    });
}

module.exports = PerformanceTester;
