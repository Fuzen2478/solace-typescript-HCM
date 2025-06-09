#!/usr/bin/env node

console.log('🚀 API Gateway 안전 모드로 실행\n');

const { spawn } = require('child_process');

// 안전 모드 환경변수
const safeEnv = {
  ...process.env,
  NODE_ENV: 'development',
  API_GATEWAY_PORT: '3000',
  GATEWAY_WS_PORT: '3010',
  HR_SERVICE_URL: 'http://localhost:3001',
  MATCHING_ENGINE_URL: 'http://localhost:3002',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  MOCK_REDIS_ENABLED: 'true'  // Mock Redis 강제 활성화
};

console.log('🔄 API Gateway 시작 중 (안전 모드)...');
console.log('📝 설정:');
console.log('  - HTTP 포트: 3000');
console.log('  - WebSocket 포트: 3010');
console.log('  - Redis: Mock 모드');
console.log('  - 서비스 검색: 활성화');

const gatewayProcess = spawn('npx', ['ts-node', '--transpile-only', 'src/services/api-gateway/index.ts'], {
  env: safeEnv,
  stdio: 'inherit'
});

gatewayProcess.on('error', (error) => {
  console.error('❌ API Gateway 시작 실패:', error.message);
  console.log('\n🔧 문제 해결 시도:');
  console.log('1. 포트 3000, 3010 정리: netstat -ano | findstr :3000');
  console.log('2. 의존성 설치: pnpm install');
  console.log('3. TypeScript 재설치: npm install -g typescript ts-node');
});

gatewayProcess.on('exit', (code) => {
  if (code !== 0) {
    console.log(`⚠️ API Gateway 종료됨 (코드: ${code})`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 API Gateway 종료 중...');
  gatewayProcess.kill('SIGTERM');
  process.exit(0);
});

console.log('\\n💡 서비스 URL:');
console.log('  • API Gateway: http://localhost:3000');
console.log('  • Health Check: http://localhost:3000/health');
console.log('  • Services: http://localhost:3000/services');
console.log('\\n🛑 종료: Ctrl+C');
