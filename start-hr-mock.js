#!/usr/bin/env node

console.log('🚀 HR Service Mock 모드로 실행\n');

const { spawn } = require('child_process');

// Mock 모드 환경변수
const mockEnv = {
  ...process.env,
  NODE_ENV: 'development',
  HR_SERVICE_PORT: '3001',
  WS_PORT: '3011',
  MOCK_LDAP_ENABLED: 'true',
  MOCK_NEO4J_ENABLED: 'true',  // 새로 추가
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379'
};

console.log('🔄 HR Resource Service 시작 중 (Mock 모드)...');
console.log('📝 설정:');
console.log('  - LDAP: Mock 활성화');
console.log('  - Neo4j: Mock 활성화 (연결 실패 시 자동 전환)');
console.log('  - Redis: localhost:6379');

const process = spawn('npx', ['ts-node', '--transpile-only', 'src/services/hr-resource/index.ts'], {
  env: mockEnv,
  stdio: 'inherit'
});

process.on('error', (error) => {
  console.error('❌ HR Service 시작 실패:', error.message);
});

process.on('exit', (code) => {
  if (code !== 0) {
    console.log(`⚠️ HR Service 종료됨 (코드: ${code})`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 HR Service 종료 중...');
  process.kill('SIGTERM');
  process.exit(0);
});

console.log('\\n💡 서비스 URL: http://localhost:3001');
console.log('🔍 헬스체크: curl http://localhost:3001/health');
console.log('🛑 종료: Ctrl+C');
