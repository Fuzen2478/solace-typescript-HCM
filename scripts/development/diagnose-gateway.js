#!/usr/bin/env node

console.log('🔍 API Gateway 문제 진단 중...\n');

const { exec } = require('child_process');

function runCommand(command, description) {
  return new Promise((resolve) => {
    console.log(`🔄 ${description}...`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ ${description} 실패:`, error.message);
      } else {
        console.log(`✅ ${description} 완료`);
      }
      if (stdout) console.log('STDOUT:', stdout);
      if (stderr) console.log('STDERR:', stderr);
      resolve({ error, stdout, stderr });
    });
  });
}

async function diagnoseGateway() {
  console.log('1. 포트 3000, 3010 사용 현황...');
  await runCommand('netstat -ano | findstr :3000', '포트 3000 확인');
  await runCommand('netstat -ano | findstr :3010', '포트 3010 확인');

  console.log('\n2. 다른 HCM 서비스 포트 확인...');
  await runCommand('netstat -ano | findstr :3001', '포트 3001 (HR)');
  await runCommand('netstat -ano | findstr :3002', '포트 3002 (Matching)');

  console.log('\n3. TypeScript 컴파일 테스트...');
  await runCommand('npx ts-node --version', 'ts-node 버전');
  
  console.log('\n4. Redis 연결 테스트...');
  await runCommand('curl -s http://localhost:6379 || echo "Redis 연결 실패"', 'Redis 상태');

  console.log('\n5. Docker Redis 확인...');
  await runCommand('docker ps | findstr redis', 'Redis 컨테이너');

  console.log('\n6. Node.js 프로세스 확인...');
  await runCommand('tasklist | findstr node', 'Node.js 프로세스');

  console.log('\n📋 문제 해결 권장사항:');
  console.log('1. 포트 충돌: taskkill /PID <PID번호> /F');
  console.log('2. Redis 없이 실행: Mock Redis 모드');
  console.log('3. TypeScript 오류: --transpile-only 옵션');
  console.log('4. 의존성 문제: pnpm install');
}

diagnoseGateway();
