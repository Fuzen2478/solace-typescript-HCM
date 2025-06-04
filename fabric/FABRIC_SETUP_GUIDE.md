# Fabric 네트워크 실행 가이드

## 전제 조건
1. Docker Desktop 실행 중
2. Hyperledger Fabric 바이너리 설치 (C:\fabric\bin)
3. PowerShell 관리자 권한으로 실행

## 단계별 실행 순서

### 1. Fabric 디렉토리로 이동
```powershell
cd C:\Users\pp\Projects\solace-typescript-HCM\fabric
```

### 2. Genesis Block과 Channel Transaction 생성
```powershell
.\generate-config.ps1
```

성공 시 다음 파일들이 생성됩니다:
- genesis.block
- mychannel.tx

### 3. Docker 컨테이너 시작
```powershell
cd ..
docker-compose down  # 기존 컨테이너 정리
docker-compose up -d
```

다음 컨테이너들이 실행됩니다:
- ca.org1.example.com
- orderer.example.com  
- peer0.org1.example.com
- neo4j
- openldap
- solace-standard

### 4. 컨테이너 상태 확인
```powershell
docker ps
```

모든 컨테이너가 "Up" 상태인지 확인

### 5. 채널 생성 및 조인
```powershell
cd fabric
.\setup-channel.ps1
```

### 6. 체인코드 배포 (추후 구현)
체인코드가 준비되면 아래 명령 실행:
```powershell
.\deploy-chaincode.ps1
```

## 문제 해결

### configtxgen 실패 시
- configtx.yaml 파일의 들여쓰기 확인 (탭 대신 스페이스 사용)
- MSP 경로가 올바른지 확인

### 채널 생성 실패 시
- Orderer가 정상 실행 중인지 확인
- genesis.block 파일이 존재하는지 확인
- MSP 권한이 올바른지 확인

### 컨테이너 로그 확인
```powershell
docker logs ca.org1.example.com
docker logs orderer.example.com
docker logs peer0.org1.example.com
```

## 네트워크 중지
```powershell
cd C:\Users\pp\Projects\solace-typescript-HCM
docker-compose down
```

## 네트워크 초기화 (문제 발생 시)
```powershell
docker-compose down -v
docker system prune -a
# fabric 디렉토리의 *.block, *.tx 파일 삭제
```
