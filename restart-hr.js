#!/usr/bin/env node

console.log('🔄 HR Resource 서비스 재시작 중...\n');

const { exec, spawn } = require('child_process');

// 1. 기존 프로세스 종료
console.log('1. 기존 HR 프로세스 종료 중...');
exec('netstat -ano | findstr :3001', (error, stdout) => {
  if (stdout) {
    const lines = stdout.trim().split('\n');
    const pids = new Set();
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const pid = parts[4];
        if (pid && pid !== '0' && !isNaN(pid)) {
          pids.add(pid);
        }
      }
    });

    pids.forEach(pid => {
      exec(`taskkill /PID ${pid} /F`, (killError) => {
        if (!killError) {
          console.log(`✅ PID ${pid} 종료 완료`);
        }
      });
    });
  }

  setTimeout(startHRService, 2000);
});

function startHRService() {
  console.log('\\n2. HR Resource 서비스 시작 중...');
  
  const hrEnv = {
    ...process.env,
    NODE_ENV: 'development',
    HR_SERVICE_PORT: '3001',
    WS_PORT: '3011',
    MOCK_LDAP_ENABLED: 'true',
    MOCK_NEO4J_ENABLED: 'true',
    NEO4J_URI: 'bolt://localhost:7687',
    NEO4J_USER: 'neo4j',
    NEO4J_PASSWORD: 'password',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379'
  };

  console.log('📝 HR Service 설정:');
  console.log('  - HTTP 포트: 3001');
  console.log('  - WebSocket 포트: 3011');
  console.log('  - LDAP: Mock 모드');
  console.log('  - Neo4j: 연결 시도 (실패 시 Mock)');
  console.log('  - Redis: localhost:6379');

  const hrProcess = spawn('pnpm', ['exec', 'ts-node', '--transpile-only', 'src/services/hr-resource/index.ts'], {
    env: hrEnv,
    stdio: 'inherit',
    shell: true
  });

  hrProcess.on('error', (error) => {
    console.error('❌ HR Service 시작 실패:', error.message);
    console.log('\\n🔧 대안:');
    console.log('pnpm run dev:hr');
  });

  hrProcess.on('exit', (code) => {
    if (code !== 0) {
      console.log(`⚠️ HR Service 종료됨 (코드: ${code})`);
    }
  });

  // 서비스 시작 확인
  setTimeout(() => {
    console.log('\\n🔍 HR Service 상태 확인 중...');
    exec('curl -s http://localhost:3001/health', (error, stdout) => {
      if (stdout) {
        console.log('✅ HR Service 정상 실행 확인!');
        console.log('응답:', stdout);
      } else {
        console.log('⚠️ HR Service 상태 확인 실패');
      }
    });
  }, 5000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\\n🛑 HR Service 종료 중...');
    hrProcess.kill('SIGTERM');
    process.exit(0);
  });

  console.log('\\n💡 접속 URL: http://localhost:3001/health');
  console.log('🛑 종료: Ctrl+C');
}
