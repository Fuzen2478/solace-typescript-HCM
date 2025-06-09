#!/usr/bin/env node

console.log('🚀 API Gateway 실행 (수정된 버전)\n');

const { spawn } = require('child_process');
const path = require('path');

// 환경변수 설정
const gatewayEnv = {
  ...process.env,
  NODE_ENV: 'development',
  API_GATEWAY_PORT: '3000',
  GATEWAY_WS_PORT: '3010',
  HR_SERVICE_URL: 'http://localhost:3001',
  MATCHING_ENGINE_URL: 'http://localhost:3002',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  MOCK_REDIS_ENABLED: 'true'
};

console.log('🔄 API Gateway 시작 중...');
console.log('📝 설정:');
console.log('  - HTTP 포트: 3000');
console.log('  - WebSocket 포트: 3010');
console.log('  - Mock Redis: 활성화');

// 여러 방법으로 시도
const attempts = [
  // 방법 1: pnpm 스크립트 사용
  () => {
    console.log('시도 1: pnpm run dev:gateway');
    return spawn('pnpm', ['run', 'dev:gateway'], {
      env: gatewayEnv,
      stdio: 'inherit',
      shell: true
    });
  },
  
  // 방법 2: pnpm exec 사용
  () => {
    console.log('시도 2: pnpm exec ts-node');
    return spawn('pnpm', ['exec', 'ts-node', '--transpile-only', 'src/services/api-gateway/index.ts'], {
      env: gatewayEnv,
      stdio: 'inherit',
      shell: true
    });
  },
  
  // 방법 3: 직접 경로 사용
  () => {
    console.log('시도 3: 직접 ts-node 경로');
    const tsNodePath = path.join(process.cwd(), 'node_modules', '.bin', 'ts-node.cmd');
    return spawn(tsNodePath, ['--transpile-only', 'src/services/api-gateway/index.ts'], {
      env: gatewayEnv,
      stdio: 'inherit'
    });
  },
  
  // 방법 4: 최소 기능 Gateway
  () => {
    console.log('시도 4: 최소 기능 Gateway');
    return spawn('pnpm', ['exec', 'ts-node', '--transpile-only', 'src/services/api-gateway/minimal.ts'], {
      env: gatewayEnv,
      stdio: 'inherit',
      shell: true
    });
  }
];

let currentAttempt = 0;
let gatewayProcess = null;

function tryNextMethod() {
  if (currentAttempt >= attempts.length) {
    console.error('❌ 모든 실행 방법 실패');
    console.log('\n🔧 수동 실행 시도:');
    console.log('1. pnpm install');
    console.log('2. pnpm run dev:gateway');
    process.exit(1);
  }

  try {
    gatewayProcess = attempts[currentAttempt]();
    
    gatewayProcess.on('error', (error) => {
      console.error(`❌ 방법 ${currentAttempt + 1} 실패:`, error.message);
      currentAttempt++;
      setTimeout(tryNextMethod, 1000);
    });

    gatewayProcess.on('exit', (code) => {
      if (code !== 0 && currentAttempt < attempts.length - 1) {
        console.log(`⚠️ 방법 ${currentAttempt + 1} 종료됨 (코드: ${code}), 다음 방법 시도...`);
        currentAttempt++;
        setTimeout(tryNextMethod, 1000);
      }
    });

    // 성공적으로 시작된 것으로 간주하는 시간
    setTimeout(() => {
      if (gatewayProcess && !gatewayProcess.killed) {
        console.log('✅ API Gateway 실행 성공!');
        console.log('\n💡 접속 URL:');
        console.log('  • Health Check: http://localhost:3000/health');
        console.log('  • Services: http://localhost:3000/services');
        console.log('\n🛑 종료: Ctrl+C');
      }
    }, 3000);

  } catch (error) {
    console.error(`❌ 방법 ${currentAttempt + 1} 실패:`, error.message);
    currentAttempt++;
    setTimeout(tryNextMethod, 1000);
  }
}

// 첫 번째 방법 시도
tryNextMethod();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 API Gateway 종료 중...');
  if (gatewayProcess && !gatewayProcess.killed) {
    gatewayProcess.kill('SIGTERM');
  }
  process.exit(0);
});
