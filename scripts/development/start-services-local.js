#!/usr/bin/env node

console.log('🚀 HCM 서비스 로컬 실행 스크립트\n');

const { spawn } = require('child_process');
const path = require('path');

// 서비스 설정
const services = [
  {
    name: 'HR Resource',
    script: 'src/services/hr-resource/index.ts',
    port: 3001,
    env: {
      NODE_ENV: 'development',
      HR_SERVICE_PORT: '3001',
      WS_PORT: '3011',
      MOCK_LDAP_ENABLED: 'true',
      NEO4J_URI: 'bolt://localhost:7687',
      NEO4J_USER: 'neo4j',
      NEO4J_PASSWORD: 'password',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379'
    }
  },
  {
    name: 'Matching Engine',
    script: 'src/services/matching-engine/index.ts',
    port: 3002,
    env: {
      NODE_ENV: 'development',
      MATCHING_ENGINE_PORT: '3002',
      MATCHING_WS_PORT: '3012',
      NEO4J_URI: 'bolt://localhost:7687',
      NEO4J_USER: 'neo4j',
      NEO4J_PASSWORD: 'password',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379'
    }
  },
  {
    name: 'API Gateway',
    script: 'src/services/api-gateway/index.ts',
    port: 3000,
    env: {
      NODE_ENV: 'development',
      API_GATEWAY_PORT: '3000',
      GATEWAY_WS_PORT: '3010',
      HR_SERVICE_URL: 'http://localhost:3001',
      MATCHING_ENGINE_URL: 'http://localhost:3002',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379'
    }
  }
];

function startService(service) {
  console.log(`🔄 ${service.name} 시작 중... (포트 ${service.port})`);
  
  const process = spawn('npx', ['ts-node', '--transpile-only', service.script], {
    env: { ...process.env, ...service.env },
    stdio: 'inherit'
  });

  process.on('error', (error) => {
    console.error(`❌ ${service.name} 시작 실패:`, error.message);
  });

  process.on('exit', (code) => {
    if (code !== 0) {
      console.log(`⚠️ ${service.name} 종료됨 (코드: ${code})`);
    }
  });

  return process;
}

function startAllServices() {
  console.log('📦 모든 HCM 서비스를 로컬에서 시작합니다...\n');
  
  const processes = [];
  
  // 서비스들을 순차적으로 시작 (의존성 고려)
  services.forEach((service, index) => {
    setTimeout(() => {
      const proc = startService(service);
      processes.push(proc);
    }, index * 3000); // 3초 간격으로 시작
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\\n🛑 모든 서비스를 종료합니다...');
    processes.forEach(proc => {
      if (proc && !proc.killed) {
        proc.kill('SIGTERM');
      }
    });
    process.exit(0);
  });

  console.log('\\n💡 서비스 URL:');
  console.log('  • API Gateway: http://localhost:3000');
  console.log('  • HR Resource: http://localhost:3001');
  console.log('  • Matching Engine: http://localhost:3002');
  console.log('\\n🔍 헬스체크:');
  console.log('  curl http://localhost:3000/health');
  console.log('  curl http://localhost:3001/health');
  console.log('  curl http://localhost:3002/health');
  console.log('\\n🛑 종료: Ctrl+C');
}

startAllServices();
