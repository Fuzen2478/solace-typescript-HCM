#!/usr/bin/env node

console.log('🔍 HR Resource 서비스 상태 진단 중...\n');

const { exec } = require('child_process');
const axios = require('axios');

async function checkHRService() {
  console.log('1. 포트 3001 상태 확인...');
  
  try {
    const response = await axios.get('http://localhost:3001/health', { timeout: 5000 });
    console.log('✅ HR Service HTTP 응답:', response.status);
    console.log('📄 응답 데이터:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ HR Service HTTP 요청 실패:', error.message);
    if (error.response) {
      console.log('응답 상태:', error.response.status);
      console.log('응답 데이터:', error.response.data);
    }
  }

  console.log('\n2. 포트 사용 확인...');
  exec('netstat -ano | findstr :3001', (error, stdout) => {
    if (stdout) {
      console.log('✅ 포트 3001 사용 중:');
      console.log(stdout);
    } else {
      console.log('❌ 포트 3001 사용되지 않음');
    }
  });

  console.log('\n3. Docker 컨테이너 상태...');
  exec('docker ps | findstr hcm-hr', (error, stdout) => {
    if (stdout) {
      console.log('📦 HR 컨테이너 상태:');
      console.log(stdout);
    } else {
      console.log('❌ HR 컨테이너 실행되지 않음');
    }
  });

  console.log('\n4. Docker 로그 확인...');
  exec('docker logs hcm-hr-resource --tail 20', (error, stdout, stderr) => {
    if (stdout) {
      console.log('📋 HR 컨테이너 로그:');
      console.log(stdout);
    }
    if (stderr) {
      console.log('⚠️ HR 컨테이너 에러:');
      console.log(stderr);
    }
    if (error) {
      console.log('❌ 로그 조회 실패:', error.message);
    }
  });

  setTimeout(() => {
    console.log('\n🔧 문제 해결 방법:');
    console.log('1. 로컬 HR 서비스 재시작: pnpm run dev:hr');
    console.log('2. Docker 컨테이너 재시작: docker-compose restart hr-resource');
    console.log('3. Neo4j 연결 문제 해결: Neo4j Mock 모드');
    console.log('4. 포트 충돌 해결: taskkill /PID <PID> /F');
  }, 3000);
}

checkHRService();
