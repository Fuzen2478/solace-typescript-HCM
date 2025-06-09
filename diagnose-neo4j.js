#!/usr/bin/env node

console.log('🔍 Neo4j 컨테이너 문제 진단 중...\n');

const { exec } = require('child_process');

function runCommand(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ 명령어 실행 실패: ${command}`);
        console.log(`오류: ${error.message}`);
        resolve(null);
      } else {
        resolve(stdout || stderr);
      }
    });
  });
}

async function diagnoseNeo4j() {
  console.log('1. Docker 컨테이너 상태 확인...');
  const containers = await runCommand('docker-compose ps');
  console.log(containers || '컨테이너 상태를 가져올 수 없습니다.');

  console.log('\n2. Neo4j 컨테이너 로그 확인...');
  const logs = await runCommand('docker-compose logs neo4j');
  console.log(logs || 'Neo4j 로그를 가져올 수 없습니다.');

  console.log('\n3. Neo4j 컨테이너 자세한 상태...');
  const inspect = await runCommand('docker inspect hcm-neo4j');
  if (inspect) {
    try {
      const data = JSON.parse(inspect);
      const state = data[0]?.State;
      console.log(`Status: ${state?.Status}`);
      console.log(`Running: ${state?.Running}`);
      console.log(`Exit Code: ${state?.ExitCode}`);
      console.log(`Error: ${state?.Error}`);
    } catch (e) {
      console.log('상태 정보 파싱 실패');
    }
  }

  console.log('\n4. 디스크 공간 확인...');
  const diskSpace = await runCommand('docker system df');
  console.log(diskSpace || '디스크 공간 정보를 가져올 수 없습니다.');

  console.log('\n5. 포트 사용 현황 확인...');
  const ports = await runCommand('netstat -ano | findstr :7474');
  console.log(ports || '포트 7474가 사용되지 않고 있습니다.');

  console.log('\n📋 문제 해결 권장사항:');
  console.log('1. 메모리 부족: Docker Desktop 메모리 설정 확인');
  console.log('2. 포트 충돌: 다른 Neo4j 인스턴스 종료');
  console.log('3. 볼륨 권한: Docker Desktop 파일 공유 설정 확인');
  console.log('4. 이미지 문제: docker pull neo4j:5-community');
}

diagnoseNeo4j();
