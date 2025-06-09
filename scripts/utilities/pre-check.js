#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🔧 HCM 시스템 실행 전 검증 시작...\n');

// 1. 환경 설정 확인
console.log('📋 1. 환경 설정 확인');

// .env.local을 .env로 복사
const envLocalPath = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envLocalPath)) {
  fs.copyFileSync(envLocalPath, envPath);
  console.log('✅ .env.local을 .env로 복사 완료');
} else {
  console.log('⚠️  .env.local 파일이 없습니다. 기본 .env 파일을 사용합니다.');
}

// 2. package.json 의존성 확인
console.log('\n📦 2. 의존성 확인');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));
const requiredDeps = ['express', 'neo4j-driver', 'ws', 'winston', 'bcrypt', 'uuid'];

console.log('필수 패키지 확인:');
requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
    console.log(`✅ ${dep} - 설치됨`);
  } else {
    console.log(`❌ ${dep} - 누락됨`);
  }
});

// 3. 포트 사용 확인 함수
async function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true); // 포트 사용 가능
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(false); // 포트 이미 사용 중
    });
  });
}

// 4. 필요한 포트들 확인
async function checkPorts() {
  console.log('\n🔌 3. 포트 가용성 확인');
  const ports = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008];
  
  for (const port of ports) {
    const available = await checkPort(port);
    if (available) {
      console.log(`✅ 포트 ${port} - 사용 가능`);
    } else {
      console.log(`⚠️  포트 ${port} - 이미 사용 중`);
    }
  }
}

// 5. 디렉터리 구조 확인
function checkDirectories() {
  console.log('\n📁 4. 디렉터리 구조 확인');
  const requiredDirs = [
    'src/services/api-gateway',
    'src/services/hr-resource', 
    'src/services/matching-engine',
    'src/services/verification',
    'src/services/edge-agent'
  ];
  
  requiredDirs.forEach(dir => {
    if (fs.existsSync(path.join(__dirname, dir))) {
      console.log(`✅ ${dir} - 존재함`);
    } else {
      console.log(`❌ ${dir} - 누락됨`);
    }
  });
}

// 6. TypeScript 컴파일 확인
function checkTypeScript() {
  console.log('\n🔧 5. TypeScript 컴파일 확인');
  return new Promise((resolve) => {
    const tsc = spawn('npx', ['tsc', '--noEmit'], { stdio: 'pipe' });
    
    let output = '';
    tsc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    tsc.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    tsc.on('close', (code) => {
      if (code === 0) {
        console.log('✅ TypeScript 컴파일 - 오류 없음');
      } else {
        console.log('⚠️  TypeScript 컴파일 - 오류 발견:');
        console.log(output);
      }
      resolve(code === 0);
    });
  });
}

// 7. 데이터베이스 연결 확인 스크립트 생성
function createDbTestScript() {
  const testScript = `
const neo4j = require('neo4j-driver');
const Redis = require('ioredis');

async function testConnections() {
  console.log('🗄️  데이터베이스 연결 테스트...');
  
  // Neo4j 연결 테스트
  try {
    const driver = neo4j.driver(
      'bolt://localhost:7687',
      neo4j.auth.basic('neo4j', 'password')
    );
    
    const session = driver.session();
    await session.run('RETURN 1');
    await session.close();
    await driver.close();
    console.log('✅ Neo4j 연결 성공');
  } catch (error) {
    console.log('❌ Neo4j 연결 실패:', error.message);
  }
  
  // Redis 연결 테스트
  try {
    const redis = new Redis({
      host: 'localhost',
      port: 6379,
      lazyConnect: true
    });
    
    await redis.connect();
    await redis.ping();
    redis.disconnect();
    console.log('✅ Redis 연결 성공');
  } catch (error) {
    console.log('❌ Redis 연결 실패:', error.message);
  }
}

testConnections();
`;
  
  fs.writeFileSync(path.join(__dirname, 'test-db-connections.js'), testScript);
  console.log('\n📝 데이터베이스 연결 테스트 스크립트 생성됨');
}

// 8. 실행 가이드 출력
function printExecutionGuide() {
  console.log('\n🚀 시스템 실행 가이드:');
  console.log('');
  console.log('1️⃣ 먼저 데이터베이스 연결 확인:');
  console.log('   node test-db-connections.js');
  console.log('');
  console.log('2️⃣ 개별 서비스 실행 (각각 새 터미널에서):');
  console.log('   npm run dev:hr         # HR Resource Service (3001)');
  console.log('   npm run dev:matching   # Matching Engine (3002)');
  console.log('   npm run dev:verification # Verification Service (3005)');
  console.log('   npm run dev:edge       # Edge Agent (3004)');
  console.log('   npm run dev:gateway    # API Gateway (3000)');
  console.log('');
  console.log('3️⃣ 또는 모든 서비스 한번에 실행:');
  console.log('   npm run dev:all');
  console.log('');
  console.log('4️⃣ 헬스체크 확인:');
  console.log('   curl http://localhost:3001/health');
  console.log('   curl http://localhost:3002/health');
  console.log('   curl http://localhost:3005/health');
  console.log('   curl http://localhost:3004/health');
  console.log('   curl http://localhost:3000/health');
  console.log('');
  console.log('5️⃣ 통합 테스트 실행:');
  console.log('   npm run test:integration:manual');
  console.log('');
}

// 메인 실행 함수
async function main() {
  checkDirectories();
  await checkPorts();
  await checkTypeScript();
  createDbTestScript();
  printExecutionGuide();
  
  console.log('\n🎯 검증 완료! 위 가이드에 따라 시스템을 실행하세요.');
}

main().catch(console.error);
