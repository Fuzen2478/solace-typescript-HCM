#!/usr/bin/env node

console.log('🚀 HCM 시스템 즉시 테스트 - 수정된 버전\n');

const axios = require('axios');

// 서비스 포트 설정 (수정된 포트들)
const services = {
  'HR Resource': 3001,
  'Matching Engine': 3002, 
  'Verification Service': 3005,  // 3003 → 3005로 변경
  'Edge Agent': 3004,
  'API Gateway': 3000
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

// 빠른 기본 테스트
async function quickTest() {
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
    console.log('');
    console.log('터미널 1: pnpm run dev:hr         # HR Resource Service');
    console.log('터미널 2: pnpm run dev:matching   # Matching Engine');  
    console.log('터미널 3: pnpm run dev:verification # Verification Service');
    console.log('터미널 4: pnpm run dev:edge       # Edge Agent');
    console.log('터미널 5: pnpm run dev:gateway    # API Gateway');
    console.log('');
    console.log('또는 한번에: pnpm run dev:all');
    
  } else if (healthyCount < totalCount) {
    console.log('\n⚠️ 일부 서비스가 실행되지 않고 있습니다:');
    results.filter(r => !r.healthy).forEach(service => {
      console.log(`  - ${service.name} (포트 ${service.port})`);
    });
    console.log('\n🔧 오류 해결 팁:');
    console.log('  1. Neo4j가 실행 중인지 확인: http://localhost:7474');
    console.log('  2. Redis가 실행 중인지 확인: redis-cli ping');
    console.log('  3. 포트 충돌 확인: netstat -ano | findstr :3001');
    
  } else {
    console.log('\n🎉 모든 서비스가 정상 동작합니다!');
    console.log('\n📝 다음 단계:');
    console.log('  1. 기본 API 테스트: curl http://localhost:3001/health');
    console.log('  2. 직원 생성 테스트 실행');
    console.log('  3. 발표 시연 준비 완료!');
    
    // 간단한 API 테스트
    await runQuickApiTest();
  }
}

// 간단한 API 테스트
async function runQuickApiTest() {
  console.log('\n🧪 기본 API 테스트...');
  
  try {
    // 1. 직원 목록 조회
    const employeesResponse = await axios.get('http://localhost:3001/employees');
    console.log(`✅ 직원 목록 조회 성공: ${employeesResponse.data.employees?.length || 0}명`);
    
    // 2. 매칭 엔진이 실행 중이면 간단한 테스트
    const services = await Promise.all([
      axios.get('http://localhost:3002/health').catch(() => null),
      axios.get('http://localhost:3005/health').catch(() => null),
    ]);
    
    if (services[0]) {
      console.log('✅ Matching Engine 정상 동작');
    }
    
    if (services[1]) {
      console.log('✅ Verification Service 정상 동작'); 
    }
    
    console.log('\n🎯 시스템 준비 완료! 발표 시연 가능합니다.');
    
  } catch (error) {
    console.log(`⚠️ API 테스트 중 오류: ${error.message}`);
  }
}

// 실행
quickTest().catch(console.error);
