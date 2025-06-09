#!/usr/bin/env node

console.log('🐳 HCM Docker 환경 빠른 시작...\n');

const { exec } = require('child_process');

// 단계별 실행 함수
function runCommand(command, description) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 ${description}...`);
    
    const process = exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ ${description} 실패:`, error.message);
        reject(error);
      } else {
        console.log(`✅ ${description} 완료`);
        if (stdout) console.log(stdout);
        resolve(stdout);
      }
    });

    process.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
  });
}

async function quickStart() {
  try {
    // 1. 기존 컨테이너 정리
    await runCommand('docker-compose down -v --remove-orphans', '기존 컨테이너 정리');

    // 2. 네트워크 정리
    await runCommand('docker network prune -f', '네트워크 정리');

    // 3. 인프라 서비스만 먼저 시작 (Neo4j, Redis)
    console.log('\n📚 데이터베이스 서비스 시작...');
    await runCommand('docker-compose up -d neo4j redis', '데이터베이스 서비스 시작');

    // 4. 데이터베이스 준비 대기
    console.log('\n⏳ 데이터베이스 준비 대기 (30초)...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // 5. 애플리케이션 서비스 빌드 및 시작
    console.log('\n🚀 애플리케이션 서비스 빌드 및 시작...');
    await runCommand('docker-compose up -d --build hr-resource matching-engine verification edge-agent', '애플리케이션 서비스 시작');

    // 6. API Gateway 마지막에 시작
    console.log('\n🌐 API Gateway 시작...');
    await runCommand('docker-compose up -d api-gateway', 'API Gateway 시작');

    // 7. 상태 확인
    console.log('\n📊 서비스 상태 확인...');
    await runCommand('docker-compose ps', '컨테이너 상태 확인');

    console.log('\n🎉 Docker 환경 구성 완료!');
    console.log('\n📝 접속 URL:');
    console.log('  • API Gateway: http://localhost:3000');
    console.log('  • HR Resource: http://localhost:3001');
    console.log('  • Matching Engine: http://localhost:3002');
    console.log('  • Verification: http://localhost:3005');
    console.log('  • Edge Agent: http://localhost:3004');
    console.log('  • Neo4j Browser: http://localhost:7474');
    console.log('  • Portainer: http://localhost:9000');
    
    console.log('\n🔍 헬스체크:');
    console.log('  curl http://localhost:3000/health');

  } catch (error) {
    console.error('\n❌ Docker 환경 구성 실패:', error.message);
    console.log('\n🔧 수동 실행:');
    console.log('  docker-compose down -v');
    console.log('  docker-compose up -d --build');
  }
}

// 실행
quickStart();
