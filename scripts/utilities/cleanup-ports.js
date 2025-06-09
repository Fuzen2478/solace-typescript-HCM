#!/usr/bin/env node

console.log('🧹 포트 정리 및 충돌 해결 스크립트\n');

const { exec } = require('child_process');

async function killProcessOnPort(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
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

        if (pids.size > 0) {
          console.log(`🔄 포트 ${port}에서 프로세스 종료 중... PIDs: ${Array.from(pids).join(', ')}`);
          
          pids.forEach(pid => {
            exec(`taskkill /PID ${pid} /F`, (killError) => {
              if (killError) {
                console.log(`⚠️ PID ${pid} 종료 실패: ${killError.message}`);
              } else {
                console.log(`✅ PID ${pid} 종료 완료`);
              }
            });
          });
          
          setTimeout(() => resolve(true), 2000);
        } else {
          console.log(`✅ 포트 ${port}: 사용 중인 프로세스 없음`);
          resolve(false);
        }
      } else {
        console.log(`✅ 포트 ${port}: 사용 가능`);
        resolve(false);
      }
    });
  });
}

async function cleanupPorts() {
  console.log('🔍 HCM 시스템 포트 정리 중...');
  
  const ports = [
    3000, // API Gateway HTTP
    3001, // HR Resource HTTP
    3002, // Matching Engine HTTP
    3003, // 기존 Matching WS (충돌 원인)
    3004, // Edge Agent HTTP
    3005, // Verification HTTP
    3006, // 기존 API Gateway WS (충돌 원인)
    3007, // 기존 HR WS (충돌 원인)
    3008, // 기존 Edge WS (충돌 원인)
    3010, // 새 API Gateway WS
    3011, // 새 HR WS
    3012, // 새 Matching WS
    3014  // 새 Edge WS
  ];

  for (const port of ports) {
    await killProcessOnPort(port);
  }

  console.log('\n🎯 새로운 포트 배치:');
  console.log('  API Gateway:     3000 (HTTP), 3010 (WebSocket)');
  console.log('  HR Resource:     3001 (HTTP), 3011 (WebSocket)');
  console.log('  Matching Engine: 3002 (HTTP), 3012 (WebSocket)');
  console.log('  Verification:    3005 (HTTP)');
  console.log('  Edge Agent:      3004 (HTTP), 3014 (WebSocket)');

  console.log('\n🚀 Docker 컨테이너 정리...');
  exec('docker-compose down', (error, stdout, stderr) => {
    if (error) {
      console.log('⚠️ Docker 정리 스킵:', error.message);
    } else {
      console.log('✅ Docker 컨테이너 정리 완료');
    }

    console.log('\n🎉 포트 정리 완료! 이제 서비스를 다시 시작할 수 있습니다.');
    console.log('\n📋 다음 명령어로 시작:');
    console.log('  pnpm run dev:gateway');
    console.log('  pnpm run dev:hr');
    console.log('  pnpm run dev:matching');
  });
}

cleanupPorts();
