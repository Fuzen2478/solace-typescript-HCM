const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  baseUrls: {
    gateway: 'http://localhost:3000',
    hr: 'http://localhost:3001',
    matching: 'http://localhost:3002',
    verification: 'http://localhost:3003',
    edge: 'http://localhost:3004',
    outsourcing: 'http://localhost:3006'
  },
  testDuration: 60, // seconds
  concurrentUsers: 10,
  rampUpTime: 30 // seconds
};

class PerformanceTestSuite {
  constructor() {
    this.results = {
      requests: [],
      errors: [],
      summary: {}
    };
  }

  async runTest() {
    console.log('🚀 Starting HCM System Performance Test Suite');
    console.log(`⏱️  Test Duration: ${CONFIG.testDuration}s`);
    console.log(`👥 Concurrent Users: ${CONFIG.concurrentUsers}`);
    console.log('');

    // Test 1: Health Check Load Test
    await this.healthCheckLoadTest();
    
    // Test 2: Employee Creation Stress Test
    await this.employeeCreationStressTest();
    
    // Test 3: Matching Engine Performance Test
    await this.matchingEnginePerformanceTest();
    
    // Test 4: Verification Service Load Test
    await this.verificationServiceLoadTest();
    
    // Test 5: Edge Agent Distributed Load Test
    await this.edgeAgentDistributedTest();
    
    // Test 6: Outsourcing Service Performance Test
    await this.outsourcingServiceTest();
    
    // Test 7: End-to-End Workflow Test
    await this.endToEndWorkflowTest();

    // Generate final report
    this.generateReport();
  }

  async healthCheckLoadTest() {
    console.log('📊 Running Health Check Load Test...');
    
    const results = await this.runConcurrentRequests(
      'Health Check',
      async () => {
        const services = Object.values(CONFIG.baseUrls);
        const promises = services.map(url => 
          this.makeRequest('GET', `${url}/health`)
        );
        return Promise.all(promises);
      },
      CONFIG.concurrentUsers,
      30 // 30 seconds
    );
    
    console.log(`✅ Health Check Test Complete - Avg Response: ${results.averageResponseTime}ms`);
  }

  async employeeCreationStressTest() {
    console.log('👥 Running Employee Creation Stress Test...');
    
    const results = await this.runConcurrentRequests(
      'Employee Creation',
      async () => {
        const employeeData = this.generateRandomEmployee();
        return this.makeRequest('POST', `${CONFIG.baseUrls.hr}/employees`, employeeData);
      },
      20, // Higher concurrency for stress test
      45
    );
    
    console.log(`✅ Employee Creation Test Complete - Avg Response: ${results.averageResponseTime}ms`);
  }

  async matchingEnginePerformanceTest() {
    console.log('🎯 Running Matching Engine Performance Test...');
    
    const results = await this.runConcurrentRequests(
      'Task Matching',
      async () => {
        const taskData = this.generateRandomTask();
        return this.makeRequest('POST', `${CONFIG.baseUrls.matching}/tasks`, taskData);
      },
      15,
      60
    );
    
    console.log(`✅ Matching Engine Test Complete - Avg Response: ${results.averageResponseTime}ms`);
  }

  async verificationServiceLoadTest() {
    console.log('🔐 Running Verification Service Load Test...');
    
    const results = await this.runConcurrentRequests(
      'Certification Verification',
      async () => {
        const certData = this.generateRandomCertification();
        return this.makeRequest('POST', `${CONFIG.baseUrls.verification}/certifications`, certData);
      },
      12,
      45
    );
    
    console.log(`✅ Verification Service Test Complete - Avg Response: ${results.averageResponseTime}ms`);
  }

  async edgeAgentDistributedTest() {
    console.log('🤖 Running Edge Agent Distributed Test...');
    
    const results = await this.runConcurrentRequests(
      'Distributed Tasks',
      async () => {
        const taskData = this.generateRandomDistributedTask();
        return this.makeRequest('POST', `${CONFIG.baseUrls.edge}/tasks`, taskData);
      },
      25, // High concurrency for distributed test
      30
    );
    
    console.log(`✅ Edge Agent Test Complete - Avg Response: ${results.averageResponseTime}ms`);
  }

  async outsourcingServiceTest() {
    console.log('🌐 Running Outsourcing Service Performance Test...');
    
    const results = await this.runConcurrentRequests(
      'Outsourcing Requests',
      async () => {
        const requestData = this.generateRandomOutsourcingRequest();
        return this.makeRequest('POST', `${CONFIG.baseUrls.outsourcing}/requests`, requestData);
      },
      8, // Lower concurrency due to external API simulation
      40
    );
    
    console.log(`✅ Outsourcing Service Test Complete - Avg Response: ${results.averageResponseTime}ms`);
  }

  async endToEndWorkflowTest() {
    console.log('🔄 Running End-to-End Workflow Test...');
    
    const results = await this.runConcurrentRequests(
      'Complete Workflow',
      async () => {
        // Step 1: Create employee
        const employee = await this.makeRequest('POST', `${CONFIG.baseUrls.hr}/employees`, this.generateRandomEmployee());
        
        // Step 2: Add certification
        await this.makeRequest('POST', `${CONFIG.baseUrls.verification}/certifications`, {
          ...this.generateRandomCertification(),
          employeeId: employee.id
        });
        
        // Step 3: Create task and match
        const task = await this.makeRequest('POST', `${CONFIG.baseUrls.matching}/tasks`, this.generateRandomTask());
        
        // Step 4: If no internal match, try outsourcing
        if (Math.random() > 0.7) {
          await this.makeRequest('POST', `${CONFIG.baseUrls.outsourcing}/requests`, this.generateRandomOutsourcingRequest());
        }
        
        return { success: true, workflow: 'complete' };
      },
      5, // Lower concurrency for complex workflow
      60
    );
    
    console.log(`✅ End-to-End Workflow Test Complete - Avg Response: ${results.averageResponseTime}ms`);
  }

  async runConcurrentRequests(testName, requestFunction, concurrency, durationSeconds) {
    const results = {
      testName,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errors: []
    };

    const startTime = Date.now();
    const endTime = startTime + (durationSeconds * 1000);
    const requestTimes = [];
    
    const workers = [];
    
    for (let i = 0; i < concurrency; i++) {
      workers.push(this.worker(requestFunction, endTime, requestTimes, results));
    }
    
    await Promise.all(workers);
    
    // Calculate statistics
    if (requestTimes.length > 0) {
      results.averageResponseTime = Math.round(requestTimes.reduce((a, b) => a + b, 0) / requestTimes.length);
      results.minResponseTime = Math.min(...requestTimes);
      results.maxResponseTime = Math.max(...requestTimes);
    }
    
    const actualDuration = (Date.now() - startTime) / 1000;
    results.requestsPerSecond = Math.round(results.totalRequests / actualDuration * 100) / 100;
    
    this.results.requests.push(results);
    return results;
  }

  async worker(requestFunction, endTime, requestTimes, results) {
    while (Date.now() < endTime) {
      try {
        const startTime = performance.now();
        await requestFunction();
        const responseTime = performance.now() - startTime;
        
        requestTimes.push(responseTime);
        results.totalRequests++;
        results.successfulRequests++;
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        
      } catch (error) {
        results.totalRequests++;
        results.failedRequests++;
        results.errors.push(error.message);
      }
    }
  }

  async makeRequest(method, url, data = null) {
    try {
      const config = {
        method,
        url,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      if (data) {
        config.data = data;
      }
      
      const response = await axios(config);
      return response.data;
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Service unavailable: ${url}`);
      }
      throw error;
    }
  }

  generateRandomEmployee() {
    const names = ['Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson', 'Eva Brown'];
    const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Operations'];
    const skills = ['JavaScript', 'Python', 'Java', 'React', 'Node.js', 'AWS', 'Docker'];
    
    return {
      name: names[Math.floor(Math.random() * names.length)],
      email: `test${Date.now()}${Math.random().toString(36).substr(2, 5)}@example.com`,
      department: departments[Math.floor(Math.random() * departments.length)],
      skills: this.getRandomSubset(skills, Math.floor(Math.random() * 4) + 1).map(skill => ({
        name: skill,
        level: ['beginner', 'intermediate', 'advanced', 'expert'][Math.floor(Math.random() * 4)]
      })),
      location: 'Remote',
      role: 'Developer'
    };
  }

  generateRandomTask() {
    const titles = ['Fix Bug', 'Implement Feature', 'Code Review', 'Deploy Service', 'Database Migration'];
    const skills = ['JavaScript', 'Python', 'Java', 'React', 'Node.js'];
    
    return {
      title: titles[Math.floor(Math.random() * titles.length)],
      description: 'Performance test task',
      requiredSkills: this.getRandomSubset(skills, Math.floor(Math.random() * 3) + 1).map(skill => ({
        name: skill,
        level: ['beginner', 'intermediate', 'advanced'][Math.floor(Math.random() * 3)],
        mandatory: Math.random() > 0.5,
        weight: Math.random() * 10
      })),
      estimatedHours: Math.floor(Math.random() * 40) + 8,
      priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      remoteAllowed: true
    };
  }

  generateRandomCertification() {
    const certs = ['AWS Certified', 'React Developer', 'Scrum Master', 'Java Expert', 'DevOps Engineer'];
    const issuers = ['AWS', 'Meta', 'Scrum.org', 'Oracle', 'Linux Foundation'];
    
    return {
      employeeId: `emp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      certificationName: certs[Math.floor(Math.random() * certs.length)],
      issuer: issuers[Math.floor(Math.random() * issuers.length)],
      issueDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  generateRandomDistributedTask() {
    const types = ['health_check', 'data_sync', 'backup', 'analytics', 'cleanup'];
    
    return {
      type: types[Math.floor(Math.random() * types.length)],
      payload: {
        description: 'Performance test distributed task',
        priority: Math.floor(Math.random() * 5) + 1
      },
      priority: Math.floor(Math.random() * 10) + 1
    };
  }

  generateRandomOutsourcingRequest() {
    const skills = ['JavaScript', 'Python', 'Java', 'React', 'Node.js', 'AWS'];
    
    return {
      requiredSkills: this.getRandomSubset(skills, Math.floor(Math.random() * 3) + 1),
      estimatedHours: Math.floor(Math.random() * 80) + 20,
      maxBudget: Math.floor(Math.random() * 5000) + 1000,
      deadline: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Performance test outsourcing request',
      remoteAllowed: true
    };
  }

  getRandomSubset(array, size) {
    const shuffled = array.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, size);
  }

  generateReport() {
    console.log('\n📊 PERFORMANCE TEST RESULTS SUMMARY');
    console.log('=====================================\n');

    let totalRequests = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    let overallAvgResponseTime = 0;

    this.results.requests.forEach(result => {
      console.log(`🧪 ${result.testName}`);
      console.log(`   Total Requests: ${result.totalRequests}`);
      console.log(`   Successful: ${result.successfulRequests} (${Math.round(result.successfulRequests/result.totalRequests*100)}%)`);
      console.log(`   Failed: ${result.failedRequests}`);
      console.log(`   Avg Response Time: ${result.averageResponseTime}ms`);
      console.log(`   Min/Max Response: ${result.minResponseTime}ms / ${result.maxResponseTime}ms`);
      console.log(`   Requests/Second: ${result.requestsPerSecond}`);
      
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? '...' : ''}`);
      }
      console.log('');

      totalRequests += result.totalRequests;
      totalSuccessful += result.successfulRequests;
      totalFailed += result.failedRequests;
      overallAvgResponseTime += result.averageResponseTime;
    });

    overallAvgResponseTime = Math.round(overallAvgResponseTime / this.results.requests.length);

    console.log('🎯 OVERALL SYSTEM PERFORMANCE');
    console.log('=============================');
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Success Rate: ${Math.round(totalSuccessful/totalRequests*100)}%`);
    console.log(`Overall Avg Response Time: ${overallAvgResponseTime}ms`);
    console.log(`System Stability: ${totalFailed < totalRequests * 0.05 ? '✅ Excellent' : totalFailed < totalRequests * 0.1 ? '⚠️  Good' : '❌ Needs Improvement'}`);
    console.log('');

    // Performance recommendations
    console.log('💡 PERFORMANCE RECOMMENDATIONS');
    console.log('==============================');
    
    if (overallAvgResponseTime > 2000) {
      console.log('⚠️  High response times detected - consider caching and optimization');
    }
    
    if (totalFailed > totalRequests * 0.05) {
      console.log('⚠️  High error rate - review error handling and service reliability');
    }
    
    if (overallAvgResponseTime < 500 && totalSuccessful > totalRequests * 0.95) {
      console.log('✅ Excellent performance - system ready for production load');
    }
    
    console.log('\n🎉 Performance test suite completed successfully!\n');
  }
}

// Run the performance test
if (require.main === module) {
  const testSuite = new PerformanceTestSuite();
  testSuite.runTest().catch(console.error);
}

module.exports = PerformanceTestSuite;