#!/usr/bin/env node

console.log('🚀 HCM 시스템 간단 실행 테스트\n');

// 환경 변수 설정
process.env.NODE_ENV = 'development';
process.env.MOCK_LDAP_ENABLED = 'true';
process.env.NEO4J_URI = 'bolt://localhost:7687';
process.env.NEO4J_USER = 'neo4j';
process.env.NEO4J_PASSWORD = 'password';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

const axios = require('axios');

// 서비스 포트 설정
const services = {
  'API Gateway': 3000,
  'HR Resource': 3001, 
  'Matching Engine': 3002,
  'Verification Service': 3005,
  'Edge Agent': 3004
};

// 헬스체크 함수
async function checkService(name, port) {
  try {
    const response = await axios.get(`http://localhost:${port}/health`, { timeout: 5000 });
    console.log(`✅ ${name} (${port}): ${response.data.status}`);
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`❌ ${name} (${port}): 서비스 미실행`);
    } else if (error.code === 'ENOTFOUND') {
      console.log(`❌ ${name} (${port}): 호스트 찾을 수 없음`);
    } else {
      console.log(`⚠️ ${name} (${port}): ${error.message}`);
    }
    return false;
  }
}

// 모든 서비스 헬스체크
async function checkAllServices() {
  console.log('🔍 서비스 상태 확인 중...\n');
  
  const results = [];
  for (const [name, port] of Object.entries(services)) {
    const isHealthy = await checkService(name, port);
    results.push({ name, port, healthy: isHealthy });
  }
  
  const healthyCount = results.filter(r => r.healthy).length;
  const totalCount = results.length;
  
  console.log(`\n📊 상태 요약: ${healthyCount}/${totalCount} 서비스 정상 동작`);
  
  if (healthyCount === 0) {
    console.log('\n⚠️ 실행 중인 서비스가 없습니다.');
    console.log('다음 명령어로 서비스를 시작하세요:');
    console.log('  npm run dev:hr         # HR Resource Service');
    console.log('  npm run dev:matching   # Matching Engine');
    console.log('  npm run dev:verification # Verification Service');
    console.log('  npm run dev:edge       # Edge Agent');
    console.log('  npm run dev:gateway    # API Gateway');
  } else if (healthyCount < totalCount) {
    console.log('\n⚠️ 일부 서비스가 실행되지 않고 있습니다.');
    results.filter(r => !r.healthy).forEach(service => {
      console.log(`  - ${service.name} (포트 ${service.port})`);
    });
  } else {
    console.log('\n🎉 모든 서비스가 정상 동작합니다!');
    console.log('\n다음 단계: 기본 API 테스트');
    await runBasicTests(results);
  }
}

// 기본 API 테스트
async function runBasicTests(services) {
  const hrService = services.find(s => s.name === 'HR Resource');
  if (!hrService || !hrService.healthy) {
    console.log('HR Resource 서비스가 실행되지 않아 테스트를 건너뜁니다.');
    return;
  }
  
  console.log('\n🧪 기본 API 테스트 실행...');
  
  try {
    // 1. 직원 목록 조회 테스트
    console.log('1️⃣ 직원 목록 조회 테스트...');
    const employeesResponse = await axios.get('http://localhost:3001/employees');
    console.log(`✅ 직원 수: ${employeesResponse.data.employees?.length || 0}명`);
    
    // 2. 샘플 직원 생성 테스트
    console.log('2️⃣ 샘플 직원 생성 테스트...');
    const newEmployee = {
      name: '테스트 개발자',
      email: `test${Date.now()}@company.com`,
      department: 'Engineering',
      skills: [
        { name: 'JavaScript', level: 'advanced', yearsOfExperience: 3 }
      ],
      availability: {
        available: true,
        capacity: 80,
        scheduledHours: 32,
        maxHoursPerWeek: 40
      },
      location: 'Seoul',
      role: 'Developer',
      workload: 0,
      maxHoursPerWeek: 40,
      timezone: 'Asia/Seoul',
      performanceRating: 4,
      completionRate: 85,
      contactInfo: {
        phone: '010-0000-0000',
        address: '서울시'
      },
      emergencyContact: {
        name: '응급연락처',
        relationship: 'family',
        phone: '010-0000-0001'
      }
    };
    
    const createResponse = await axios.post('http://localhost:3001/employees', newEmployee);
    console.log(`✅ 직원 생성 성공: ${createResponse.data.name} (ID: ${createResponse.data.id})`);
    
    // 3. 매칭 엔진 테스트 (실행 중인 경우)
    const matchingService = services.find(s => s.name === 'Matching Engine');
    if (matchingService && matchingService.healthy) {
      console.log('3️⃣ 매칭 엔진 테스트...');
      
      const taskRequest = {
        title: '테스트 작업',
        description: '간단한 JavaScript 작업',
        requiredSkills: [
          { name: 'JavaScript', level: 'intermediate', mandatory: true, weight: 8 }
        ],
        priority: 'medium',
        estimatedHours: 16,
        remoteAllowed: true,
        createdBy: 'test-system'
      };
      
      const matchResponse = await axios.post('http://localhost:3002/tasks', taskRequest);
      console.log(`✅ 작업 매칭 성공: ${matchResponse.data.task?.title || '작업'}`);
      
      if (matchResponse.data.matches && matchResponse.data.matches.length > 0) {
        console.log(`   매칭된 후보자: ${matchResponse.data.matches.length}명`);
      }
    }
    
    console.log('\n🎉 기본 테스트 완료!');
    console.log('\n다음 단계:');
    console.log('  1. 브라우저에서 http://localhost:3000 접속 (API Gateway)');
    console.log('  2. 더 자세한 테스트: npm run test:integration:manual');
    
  } catch (error) {
    console.log(`❌ 테스트 실패: ${error.message}`);
    if (error.response) {
      console.log(`   상태 코드: ${error.response.status}`);
      console.log(`   응답: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// 데이터베이스 연결 확인
async function checkDatabases() {
  console.log('🗄️ 데이터베이스 연결 확인...\n');
  
  // Neo4j 연결 테스트 (간접적)
  try {
    // HR 서비스를 통해 Neo4j 연결 확인
    const response = await axios.get('http://localhost:3001/health');
    if (response.data.services?.neo4j === 'connected') {
      console.log('✅ Neo4j: 연결됨 (HR 서비스를 통해 확인)');
    } else {
      console.log('⚠️ Neo4j: 상태 불명');
    }
  } catch (error) {
    console.log('❌ Neo4j: HR 서비스가 실행되지 않아 확인 불가');
  }
  
  // Redis 연결 테스트 (간접적)
  try {
    const response = await axios.get('http://localhost:3001/health');
    if (response.data.services?.redis || response.data.services?.redis === 'ready') {
      console.log('✅ Redis: 연결됨');
    } else {
      console.log('⚠️ Redis: 상태 불명');
    }
  } catch (error) {
    console.log('❌ Redis: 서비스가 실행되지 않아 확인 불가');
  }
  
  console.log('');
}

// 메인 실행
async function main() {
  try {
    await checkDatabases();
    await checkAllServices();
  } catch (error) {
    console.error('❌ 실행 중 오류:', error.message);
  }
}

// 3초 후에 실행 (서비스들이 시작할 시간을 줌)
setTimeout(main, 1000);
