#!/usr/bin/env node

console.log('🔍 HR Resource & Matching Engine 컨테이너 문제 진단 중...\n');

const { exec } = require('child_process');

function runCommand(command, description) {
  return new Promise((resolve) => {
    console.log(`🔄 ${description}...`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ ${description} 실패:`, error.message);
        resolve(null);
      } else {
        console.log(`✅ ${description} 완료`);
        if (stdout) console.log(stdout);
        if (stderr) console.log('stderr:', stderr);
        resolve(stdout || stderr);
      }
    });
  });
}

async function diagnoseServices() {
  console.log('1. 컨테이너 상태 확인...');
  await runCommand('docker-compose ps', '모든 컨테이너 상태');

  console.log('\n2. HR Resource 컨테이너 로그...');
  await runCommand('docker-compose logs hr-resource', 'HR Resource 로그');

  console.log('\n3. Matching Engine 컨테이너 로그...');
  await runCommand('docker-compose logs matching-engine', 'Matching Engine 로그');

  console.log('\n4. Docker 이미지 빌드 상태...');
  await runCommand('docker images | findstr hcm', 'HCM 이미지');

  console.log('\n5. Dockerfile 존재 확인...');
  await runCommand('dir Dockerfile', 'Dockerfile 확인');

  console.log('\n6. 디스크 공간 확인...');
  await runCommand('docker system df', '디스크 사용량');

  console.log('\n📋 문제 해결 권장사항:');
  console.log('1. Dockerfile 문제: 이미지 빌드 실패');
  console.log('2. 의존성 문제: Node.js 모듈 설치 실패');
  console.log('3. 포트 충돌: 다른 프로세스가 포트 사용 중');
  console.log('4. 메모리 부족: Docker Desktop 리소스 부족');
  console.log('5. 네트워크 문제: 서비스 간 연결 실패');
}

diagnoseServices();
