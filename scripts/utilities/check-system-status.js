#!/usr/bin/env node

console.log('🔍 현재 시스템 상태 확인 중...\n');

const { exec } = require('child_process');

function checkPort(port, serviceName) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port}`, (error, stdout, stderr) => {
      if (stdout && stdout.includes(`:${port}`)) {
        console.log(`✅ ${serviceName} (포트 ${port}): 실행 중`);
        resolve(true);
      } else {
        console.log(`❌ ${serviceName} (포트 ${port}): 실행되지 않음`);
        resolve(false);
      }
    });
  });
}

async function checkServices() {
  console.log('🔍 포트 상태 확인:');
  
  const services = [
    { port: 3000, name: 'API Gateway' },
    { port: 3001, name: 'HR Resource' },
    { port: 3002, name: 'Matching Engine' },
    { port: 3005, name: 'Verification' },
    { port: 3004, name: 'Edge Agent' },
    { port: 7474, name: 'Neo4j Browser' },
    { port: 6379, name: 'Redis' }
  ];

  for (const service of services) {
    await checkPort(service.port, service.name);
  }

  console.log('\n🐳 Docker 컨테이너 상태:');
  exec('docker ps --filter "name=hcm-" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"', (error, stdout) => {
    if (stdout) {
      console.log(stdout);
    } else {
      console.log('Docker 컨테이너가 실행되지 않았거나 확인할 수 없습니다.');
    }
  });
}

checkServices();
