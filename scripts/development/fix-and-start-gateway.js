#!/usr/bin/env node

console.log('🔧 API Gateway 문제 해결 및 실행\n');

const { exec, spawn } = require('child_process');

async function fixAndStartGateway() {
  console.log('1. 포트 3000 상태 확인...');
  
  // 포트 3000 사용 중인 프로세스 확인
  exec('netstat -ano | findstr :3000', (error, stdout) => {
    if (stdout) {
      console.log('⚠️ 포트 3000 사용 중:');
      console.log(stdout);
      
      // PID 추출 및 종료
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

      if (pids.size > 0) {
        console.log('🔄 포트 3000 프로세스 종료 중...');
        pids.forEach(pid => {
          exec(`taskkill /PID ${pid} /F`, (killError) => {
            if (!killError) {
              console.log(`✅ PID ${pid} 종료 완료`);
            }
          });
        });
        
        // 2초 후 Gateway 시작
        setTimeout(startGateway, 2000);
      }
    } else {
      console.log('✅ 포트 3000 사용 가능');
      startGateway();
    }
  });
}

function startGateway() {
  console.log('\\n🚀 API Gateway 시작 중...');
  
  const gatewayEnv = {
    ...process.env,
    NODE_ENV: 'development',
    API_GATEWAY_PORT: '3000',
    GATEWAY_WS_PORT: '3010',
    HR_SERVICE_URL: 'http://localhost:3001',
    MATCHING_ENGINE_URL: 'http://localhost:3002',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379'
  };

  console.log('📝 Gateway 설정:');
  console.log('  - HTTP 포트: 3000');
  console.log('  - WebSocket 포트: 3010');
  console.log('  - HR Service: http://localhost:3001');
  console.log('  - Matching Service: http://localhost:3002');

  // 여러 방법 순차 시도
  const methods = [
    // 방법 1: 최소 기능 Gateway
    () => {
      console.log('\\n시도 1: 최소 기능 Gateway');
      return spawn('npx', ['ts-node', '--transpile-only', 'src/services/api-gateway/minimal.ts'], {
        env: gatewayEnv,
        stdio: 'inherit'
      });
    },
    
    // 방법 2: 정상 Gateway
    () => {
      console.log('\\n시도 2: 정상 Gateway');
      return spawn('pnpm', ['run', 'dev:gateway'], {
        env: gatewayEnv,
        stdio: 'inherit',
        shell: true
      });
    },
    
    // 방법 3: pnpm exec
    () => {
      console.log('\\n시도 3: pnpm exec');
      return spawn('pnpm', ['exec', 'ts-node', '--transpile-only', 'src/services/api-gateway/index.ts'], {
        env: gatewayEnv,
        stdio: 'inherit',
        shell: true
      });
    }
  ];

  let currentMethod = 0;
  let gatewayProcess = null;

  function tryNextMethod() {
    if (currentMethod >= methods.length) {
      console.error('❌ 모든 방법 실패');
      return;
    }

    try {
      gatewayProcess = methods[currentMethod]();
      
      gatewayProcess.on('error', (error) => {
        console.error(`❌ 방법 ${currentMethod + 1} 실패:`, error.message);
        currentMethod++;
        setTimeout(tryNextMethod, 1000);
      });

      gatewayProcess.on('exit', (code) => {
        if (code !== 0 && currentMethod < methods.length - 1) {
          console.log(`⚠️ 방법 ${currentMethod + 1} 종료 (코드: ${code}), 다음 방법 시도...`);
          currentMethod++;
          setTimeout(tryNextMethod, 1000);
        }
      });

      // 3초 후 성공 여부 확인
      setTimeout(() => {
        if (gatewayProcess && !gatewayProcess.killed) {
          console.log('\\n✅ API Gateway 실행 성공!');
          
          // 헬스체크
          setTimeout(() => {
            exec('curl -s http://localhost:3000/health', (error, stdout) => {
              if (stdout) {
                console.log('🎉 Gateway 헬스체크 성공!');
                console.log('\\n🔗 접속 URL:');
                console.log('  • API Gateway: http://localhost:3000/health');
                console.log('  • Services: http://localhost:3000/services');
                console.log('  • HR via Gateway: http://localhost:3000/api/hr/health');
              } else {
                console.log('⚠️ Gateway 헬스체크 대기 중...');
              }
            });
          }, 2000);
        }
      }, 3000);

    } catch (error) {
      console.error(`❌ 방법 ${currentMethod + 1} 실행 실패:`, error.message);
      currentMethod++;
      setTimeout(tryNextMethod, 1000);
    }
  }

  tryNextMethod();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\\n🛑 Gateway 종료 중...');
    if (gatewayProcess && !gatewayProcess.killed) {
      gatewayProcess.kill('SIGTERM');
    }
    process.exit(0);
  });
}

fixAndStartGateway();
