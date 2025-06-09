#!/usr/bin/env node

console.log('🔍 포트 사용 현황 확인 중...\n');

const { exec } = require('child_process');

function checkPort(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port}`, (error, stdout, stderr) => {
      if (stdout && stdout.includes(`:${port}`)) {
        const lines = stdout.trim().split('\n');
        const processes = lines.map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            protocol: parts[0],
            address: parts[1],
            state: parts[3],
            pid: parts[4]
          };
        });
        resolve({ port, inUse: true, processes });
      } else {
        resolve({ port, inUse: false, processes: [] });
      }
    });
  });
}

async function checkAllPorts() {
  const ports = [
    { port: 3000, service: 'API Gateway (HTTP)' },
    { port: 3001, service: 'HR Resource (HTTP)' },
    { port: 3002, service: 'Matching Engine (HTTP)' },
    { port: 3003, service: 'Matching Engine (WebSocket)' },
    { port: 3004, service: 'Edge Agent (HTTP)' },
    { port: 3005, service: 'Verification (HTTP)' },
    { port: 3006, service: 'API Gateway (WebSocket) - 문제 포트!' },
    { port: 3007, service: 'HR Resource (WebSocket)' },
    { port: 3008, service: 'Edge Agent (WebSocket)' },
    { port: 6379, service: 'Redis' },
    { port: 7474, service: 'Neo4j Browser' },
    { port: 7687, service: 'Neo4j Bolt' },
    { port: 9000, service: 'Portainer' }
  ];

  console.log('📊 포트 사용 현황:');
  console.log('='.repeat(60));

  for (const { port, service } of ports) {
    const result = await checkPort(port);
    if (result.inUse) {
      console.log(`❌ 포트 ${port} (${service}): 사용 중`);
      result.processes.forEach(proc => {
        console.log(`   PID: ${proc.pid}, 상태: ${proc.state}`);
      });
    } else {
      console.log(`✅ 포트 ${port} (${service}): 사용 가능`);
    }
  }

  console.log('\n🔧 문제 해결 방법:');
  console.log('1. 사용 중인 프로세스 종료: taskkill /PID <PID번호> /F');
  console.log('2. 다른 포트로 변경');
  console.log('3. Docker 컨테이너 정리: docker-compose down');
}

checkAllPorts();
