# HCM 프로젝트 테스트 가이드

## 📋 목차
1. [테스트 개요](#테스트-개요)
2. [테스트 환경 설정](#테스트-환경-설정)
3. [테스트 유형별 가이드](#테스트-유형별-가이드)
4. [시나리오 기반 테스트](#시나리오-기반-테스트)
5. [성능 테스트](#성능-테스트)
6. [장애 복구 테스트](#장애-복구-테스트)
7. [테스트 자동화](#테스트-자동화)
8. [문제 해결 가이드](#문제-해결-가이드)

## 🎯 테스트 개요

### 테스트 목표
- 시스템 통합성 검증
- 성능 지표 달성 확인
- 장애 상황 대응 능력 검증
- 비즈니스 요구사항 충족 확인

### 테스트 범위
- **마이크로서비스 통합**: 6개 서비스 간 통신
- **블록체인 네트워크**: Hyperledger Fabric 기능
- **분산 데이터베이스**: Neo4j 클러스터
- **메시징 시스템**: Solace PubSub+
- **인증 시스템**: LDAP 통합
- **AI 엔진**: 지능형 매칭 알고리즘

## 🛠 테스트 환경 설정

### 1. 사전 요구사항 확인
```bash
# Docker 및 Docker Compose 버전 확인
docker --version
docker-compose --version

# Node.js 및 npm 버전 확인
node --version
npm --version

# 메모리 및 디스크 공간 확인
docker system df
```

### 2. 테스트 환경 구축
```bash
# 프로젝트 디렉토리로 이동
cd C:/Users/pp/Projects/solace-typescript-HCM

# 의존성 설치
npm install

# 테스트 전용 환경 변수 설정
cp .env.test.example .env.test

# Docker 네트워크 초기화
docker network prune -f
docker volume prune -f
```

### 3. 테스트 데이터 준비
```bash
# 테스트 데이터베이스 초기화
npm run test:db:init

# 샘플 데이터 로드
npm run test:data:load

# 블록체인 테스트 네트워크 초기화
npm run test:fabric:init
```

## 🧪 테스트 유형별 가이드

### Unit Tests (단위 테스트)

#### 실행 방법
```bash
# 전체 단위 테스트 실행
npm test

# 특정 서비스 단위 테스트
npm test -- --grep "MatchingEngine"
npm test -- --grep "ResourceService"
npm test -- --grep "ValidatorService"

# 커버리지 포함 실행
npm run test:coverage
```

#### 주요 테스트 케이스
1. **매칭 엔진 테스트**
   - 기술 매칭 정확도 (목표: 85%)
   - 가용성 매칭 정확도
   - 비용 최적화 알고리즘

2. **리소스 서비스 테스트**
   - CRUD 작업 정확성
   - 데이터 일관성 검증
   - 트랜잭션 롤백 처리

3. **검증 서비스 테스트**
   - 실시간 검증 로직
   - 규칙 엔진 정확성
   - 예외 상황 처리

### Integration Tests (통합 테스트)

#### 실행 방법
```bash
# 통합 테스트 실행
npm run test:integration

# 특정 통합 시나리오 테스트
npm run test:integration -- --scenario="full-workflow"
npm run test:integration -- --scenario="disaster-recovery"
```

#### 주요 통합 테스트
1. **서비스 간 통신 테스트**
   ```bash
   # API 게이트웨이 → 매칭 엔진
   curl -X POST http://localhost:3000/api/matching/find \
     -H "Content-Type: application/json" \
     -d '{"skills": ["React", "Node.js"], "duration": "3months"}'
   ```

2. **블록체인 통합 테스트**
   ```bash
   # 체인코드 호출 테스트
   docker exec fabric-cli peer chaincode invoke \
     -C mychannel -n hcm \
     -c '{"function":"createResource","Args":["resource1","developer","available"]}'
   ```

3. **데이터 동기화 테스트**
   ```bash
   # CRDT 동기화 확인
   npm run test:crdt:sync
   ```

### End-to-End Tests (E2E 테스트)

#### 실행 방법
```bash
# E2E 테스트 환경 시작
npm run test:e2e:setup

# E2E 테스트 실행
npm run test:e2e

# E2E 테스트 환경 정리
npm run test:e2e:cleanup
```

## 📊 시나리오 기반 테스트

### 시나리오 1: 기본 워크플로우 테스트
```bash
# 시나리오 실행
npm run test:scenario:basic

# 또는 수동 실행
cd tests/scenarios
node basic-workflow-test.js
```

**검증 항목:**
- [ ] 인력 등록 성공
- [ ] 프로젝트 요청 처리
- [ ] 매칭 결과 생성 (3초 이내)
- [ ] 계약 생성 및 블록체인 기록
- [ ] 실시간 상태 업데이트

### 시나리오 2: 고부하 상황 테스트
```bash
# 100개 동시 요청 테스트
npm run test:scenario:load -- --concurrent=100

# 1000개 순차 요청 테스트
npm run test:scenario:load -- --sequential=1000
```

**성능 지표 확인:**
- [ ] 응답 시간 < 3초 (95th percentile)
- [ ] 메모리 사용량 < 4GB
- [ ] CPU 사용률 < 80%
- [ ] 에러율 < 1%

### 시나리오 3: 장애 상황 테스트
```bash
# 네트워크 분할 시뮬레이션
npm run test:scenario:network-partition

# 서비스 장애 시뮬레이션
npm run test:scenario:service-failure

# 데이터베이스 장애 시뮬레이션
npm run test:scenario:db-failure
```

## 🚀 성능 테스트

### 부하 테스트 실행
```bash
# Apache Bench를 사용한 부하 테스트
ab -n 1000 -c 50 http://localhost:3000/api/health

# Artillery를 사용한 상세 부하 테스트
npm run test:load:detailed
```

### 성능 모니터링
```bash
# 실시간 성능 모니터링 시작
npm run monitor:performance

# 메트릭 수집
docker exec prometheus prometheus \
  --query="rate(http_requests_total[5m])"
```

### 성능 기준치
| 지표 | 목표값 | 측정방법 |
|------|--------|---------|
| 응답시간 | < 3초 | API 호출 응답시간 |
| 처리량 | > 100 TPS | 초당 트랜잭션 수 |
| 가용성 | 99.95% | 업타임 모니터링 |
| 메모리 사용량 | < 4GB | Docker stats |

## 🔄 장애 복구 테스트

### Chaos Engineering 테스트
```bash
# 랜덤 서비스 종료
npm run test:chaos:kill-random-service

# 네트워크 지연 시뮬레이션
npm run test:chaos:network-delay

# 메모리 부족 시뮬레이션
npm run test:chaos:memory-stress
```

### 복구 시나리오 검증
1. **서비스 자동 재시작 확인**
   ```bash
   # 서비스 강제 종료
   docker kill hcm-matching-engine
   
   # 30초 후 복구 확인
   sleep 30
   curl http://localhost:3001/health
   ```

2. **데이터 일관성 복구 확인**
   ```bash
   # CRDT 동기화 복구 테스트
   npm run test:recovery:crdt-sync
   ```

3. **블록체인 네트워크 복구 확인**
   ```bash
   # Fabric 피어 복구 테스트
   npm run test:recovery:fabric-peer
   ```

## 🤖 테스트 자동화

### CI/CD 파이프라인 테스트
```yaml
# .github/workflows/test.yml 예시
name: HCM Test Pipeline
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm test
      - name: Run integration tests
        run: npm run test:integration
      - name: Run E2E tests
        run: npm run test:e2e
```

### 자동화된 회귀 테스트
```bash
# 매일 밤 12시에 실행되는 회귀 테스트
npm run test:regression:nightly

# 주간 전체 테스트 스위트
npm run test:regression:weekly
```

## 🔧 문제 해결 가이드

### 일반적인 문제와 해결책

#### 1. Docker 컨테이너 시작 실패
```bash
# 로그 확인
docker-compose logs service-name

# 리소스 부족 시
docker system prune -a
docker volume prune -f

# 포트 충돌 시
netstat -tulpn | grep :3000
```

#### 2. 블록체인 네트워크 연결 실패
```bash
# Fabric 네트워크 상태 확인
docker exec fabric-cli peer node status

# 채널 정보 확인
docker exec fabric-cli peer channel list

# 체인코드 상태 확인
docker exec fabric-cli peer chaincode list --installed
```

#### 3. 성능 저하 문제
```bash
# 메모리 사용량 확인
docker stats

# CPU 사용률 확인
top -p $(pgrep -d, -f "node")

# 네트워크 지연 확인
ping localhost
```

### 로그 분석 및 디버깅

#### 로그 수집
```bash
# 모든 서비스 로그 수집
docker-compose logs > logs/full-system.log

# 특정 시간대 로그 필터링
docker-compose logs --since="2024-01-01T00:00:00"

# 에러 로그만 필터링
docker-compose logs | grep -i error
```

#### 디버깅 모드 실행
```bash
# 디버그 모드로 서비스 시작
DEBUG=* npm start

# 특정 모듈 디버깅
DEBUG=matching-engine npm start
```

## 📈 테스트 리포팅

### 테스트 결과 리포트 생성
```bash
# HTML 리포트 생성
npm run test:report:html

# JSON 리포트 생성
npm run test:report:json

# JUnit XML 리포트 생성
npm run test:report:junit
```

### 커버리지 리포트
```bash
# 코드 커버리지 확인
npm run test:coverage

# 상세 커버리지 리포트
open coverage/index.html
```

## 🎯 테스트 체크리스트

### 배포 전 필수 테스트
- [ ] 모든 단위 테스트 통과
- [ ] 통합 테스트 통과
- [ ] E2E 테스트 통과
- [ ] 성능 기준치 달성
- [ ] 보안 취약점 스캔 통과
- [ ] 장애 복구 테스트 통과

### 주간 테스트 스케줄
- **월요일**: 단위 테스트 + 통합 테스트
- **화요일**: 성능 테스트
- **수요일**: E2E 테스트
- **목요일**: 장애 복구 테스트
- **금요일**: 전체 회귀 테스트

## 📞 지원 및 연락처

### 기술 지원
- **이슈 리포팅**: GitHub Issues
- **긴급 연락**: Slack #hcm-support
- **문서 업데이트**: 개발팀 리뷰 후 반영

### 추가 리소스
- [API 문서](./API_REFERENCE.md)
- [아키텍처 가이드](./ARCHITECTURE.md)
- [배포 가이드](./DEPLOYMENT_GUIDE.md)
- [운영 가이드](./OPERATIONS_GUIDE.md)
