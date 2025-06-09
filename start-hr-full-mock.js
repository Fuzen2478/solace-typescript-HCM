#!/usr/bin/env node

console.log('🚀 HR Resource Mock 모드로 실행\n');

const { spawn } = require('child_process');

// 완전 Mock 모드 환경변수
const mockEnv = {
  ...process.env,
  NODE_ENV: 'development',
  HR_SERVICE_PORT: '3001',
  WS_PORT: '3011',
  MOCK_LDAP_ENABLED: 'true',
  MOCK_NEO4J_ENABLED: 'true',
  MOCK_REDIS_ENABLED: 'true',
  SKIP_DATABASE_INIT: 'true',  // 데이터베이스 초기화 건너뛰기
  SKIP_HEALTH_CHECKS: 'false'   // 헬스체크는 유지
};

console.log('🔄 HR Resource 시작 중 (완전 Mock 모드)...');
console.log('📝 설정:');
console.log('  - 모든 외부 의존성: Mock 모드');
console.log('  - 데이터베이스: 메모리 기반');
console.log('  - LDAP: Mock 활성화');
console.log('  - 초기화: 건너뛰기');

const process = spawn('pnpm', ['exec', 'ts-node', '--transpile-only', 'src/services/hr-resource/index.ts'], {
  env: mockEnv,
  stdio: 'inherit',
  shell: true
});

process.on('error', (error) => {
  console.error('❌ HR Service 시작 실패:', error.message);
});

process.on('exit', (code) => {
  if (code !== 0) {
    console.log(`⚠️ HR Service 종료됨 (코드: ${code})`);
  }
});

// 시작 확인
setTimeout(() => {
  console.log('\\n🔍 서비스 확인 중...');
  const { exec } = require('child_process');
  exec('curl -s http://localhost:3001/health || echo "연결 대기 중..."', (error, stdout) => {
    console.log('상태:', stdout);
  });
}, 3000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 HR Service 종료 중...');
  process.kill('SIGTERM');
  process.exit(0);
});

console.log('\\n💡 서비스 URL: http://localhost:3001');
console.log('🔍 헬스체크: curl http://localhost:3001/health');
console.log('🛑 종료: Ctrl+C');
