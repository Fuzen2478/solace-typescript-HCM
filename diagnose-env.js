#!/usr/bin/env node

console.log('🔍 Node.js 환경 진단 중...\n');

const { exec } = require('child_process');
const path = require('path');

function checkCommand(command, description) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ ${description}: ${error.message}`);
        resolve(false);
      } else {
        console.log(`✅ ${description}: ${stdout.trim()}`);
        resolve(true);
      }
    });
  });
}

async function diagnoseEnvironment() {
  console.log('📋 환경 진단:');
  
  await checkCommand('node --version', 'Node.js 버전');
  await checkCommand('npm --version', 'npm 버전');
  await checkCommand('pnpm --version', 'pnpm 버전');
  await checkCommand('npx --version', 'npx 버전');
  await checkCommand('where node', 'Node.js 경로');
  await checkCommand('where npm', 'npm 경로');
  await checkCommand('where pnpm', 'pnpm 경로');
  
  console.log('\n🔧 대안 실행 방법:');
  console.log('1. pnpm run dev:gateway');
  console.log('2. pnpm exec ts-node --transpile-only src/services/api-gateway/index.ts');
  console.log('3. node_modules\\.bin\\ts-node --transpile-only src/services/api-gateway/index.ts');
  
  console.log('\n📝 환경변수 설정:');
  console.log('set NODE_ENV=development');
  console.log('set API_GATEWAY_PORT=3000');
  console.log('set GATEWAY_WS_PORT=3010');
  
  // 로컬 경로 확인
  console.log('\n📁 로컬 경로 확인:');
  console.log('현재 디렉토리:', process.cwd());
  console.log('ts-node 경로:', path.join(process.cwd(), 'node_modules', '.bin', 'ts-node.cmd'));
}

diagnoseEnvironment();
