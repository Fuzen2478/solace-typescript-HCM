# 🔍 HCM 시스템 코드 검증 가이드

## 📋 검증 단계별 실행 방법

### 1️⃣ **빠른 검증 (2-3분)**
```bash
# 설정 검증만 수행
pnpm validate:docker

# 또는 빠른 전체 검증
pnpm verify:quick
```

### 2️⃣ **표준 검증 (5-7분)**
```bash
# 전체 시스템 시작 후 기본 검증
pnpm docker:dev:all
pnpm health-check
pnpm verify:services
```

### 3️⃣ **완전한 검증 (8-12분)**
```bash
# 완전한 검증 (추천)
pnpm verify:complete
```

### 4️⃣ **포괄적 검증 (15-20분)**
```bash
# 보고서 포함 완전 검증
pnpm verify:full
```

## 🎯 단계별 세부 검증

### Phase 1: 사전 검증
```bash
# 1. Docker 설정 검증
pnpm validate:docker

# 2. 시스템 시작
pnpm docker:dev:all
```

### Phase 2: 서비스 검증
```bash
# 3. 헬스체크
pnpm health-check

# 4. 개별 서비스 검증
pnpm verify:services
```

### Phase 3: 기능 검증
```bash
# 5. 비즈니스 로직 테스트
pnpm verify:functional

# 6. 로그 분석
pnpm analyze:logs
```

### Phase 4: 심화 검증
```bash
# 7. Docker 환경 테스트
pnpm test:docker

# 8. 통합 테스트
pnpm test:integration
```

## 🚨 문제 해결 가이드

### 자주 발생하는 문제들

#### 1. **포트 충돌**
```bash
# 문제 확인
netstat -an | findstr :3001

# 해결방법
pnpm docker:down
pnpm docker:up
```

#### 2. **서비스 시작 실패**
```bash
# 로그 확인
pnpm analyze:logs -Service api-gateway

# 컨테이너 재시작
docker-compose restart api-gateway
```

#### 3. **헬스체크 실패**
```bash
# 개별 서비스 상태 확인
docker-compose ps

# 특정 서비스 로그 확인
docker-compose logs api-gateway
```

#### 4. **데이터베이스 연결 실패**
```bash
# 데이터베이스 상태 확인
docker exec hcm-postgres pg_isready -U postgres
docker exec hcm-redis redis-cli -a redispassword ping
docker exec neo4j cypher-shell -u neo4j -p password "RETURN 1"
```

## 📊 검증 결과 해석

### ✅ 성공 기준
- **모든 헬스체크 통과**
- **모든 서비스 응답**
- **데이터베이스 연결 성공**
- **API Gateway 라우팅 작동**
- **워크플로우 실행 성공**

### ⚠️ 경고 상황
- **일부 서비스 느린 응답**
- **로그에 경고 메시지**
- **메모리 사용량 높음**
- **디스크 공간 부족**

### ❌ 실패 상황
- **서비스 시작 실패**
- **데이터베이스 연결 불가**
- **API 응답 없음**
- **컨테이너 크래시**

## 🔧 수동 검증 방법

### 1. **웹 브라우저 검증**
```
✅ http://localhost - 메인 대시보드
✅ http://localhost:3001/health - API Gateway 헬스
✅ http://localhost:7474 - Neo4j 브라우저
✅ http://localhost:8080 - Solace 관리자
✅ http://localhost:9001 - Portainer
```

### 2. **API 엔드포인트 검증**
```bash
# PowerShell에서
Invoke-RestMethod -Uri "http://localhost:3001/health"
Invoke-RestMethod -Uri "http://localhost:3001/services"
Invoke-RestMethod -Uri "http://localhost:3001/analytics/overview"
```

### 3. **데이터베이스 직접 접속**
```bash
# PostgreSQL
docker exec -it hcm-postgres psql -U postgres -d hcm_db

# Redis
docker exec -it hcm-redis redis-cli -a redispassword

# Neo4j
docker exec -it neo4j cypher-shell -u neo4j -p password
```

## 📈 성능 검증

### CPU 및 메모리 모니터링
```bash
# 실시간 리소스 사용량
docker stats

# 개별 컨테이너 상태
docker-compose ps
```

### 응답 시간 측정
```bash
# API 응답 시간 측정
$start = Get-Date
Invoke-RestMethod -Uri "http://localhost:3001/health"
$end = Get-Date
($end - $start).TotalMilliseconds
```

## 🎯 검증 체크리스트

### ✅ 필수 검증 항목
- [ ] Docker 설정 유효성
- [ ] 모든 컨테이너 실행 중
- [ ] 헬스체크 모두 통과
- [ ] API Gateway 응답
- [ ] 데이터베이스 연결
- [ ] 서비스 간 통신
- [ ] Nginx 프록시 작동

### ✅ 기능 검증 항목
- [ ] 직원 온보딩 워크플로우
- [ ] 태스크 할당 워크플로우
- [ ] 시스템 모니터링
- [ ] 로그 수집 및 분석
- [ ] 실시간 상태 업데이트

### ✅ 성능 검증 항목
- [ ] 동시 요청 처리
- [ ] 응답 시간 < 1초
- [ ] 메모리 사용량 < 80%
- [ ] CPU 사용량 안정적
- [ ] 네트워크 지연 최소

## 🚀 최종 검증 명령어

### 원클릭 완전 검증
```bash
# 모든 것을 한 번에 검증
pnpm verify:full
```

### 빠른 상태 확인
```bash
# 30초 안에 시스템 상태 확인
pnpm verify:quick && pnpm health-check
```

### 지속적 모니터링
```bash
# 실시간 로그 모니터링
pnpm analyze:logs -Follow
```

## 📄 보고서 생성

검증 완료 후 자동으로 생성되는 보고서:
- **위치**: `./test-results/verification-report-YYYYMMDD-HHMMSS.md`
- **내용**: 상세한 테스트 결과 및 권장사항
- **형식**: Markdown (GitHub, 문서화 도구에서 활용 가능)

---

**💡 팁**: 개발 중에는 `pnpm verify:quick`으로 빠른 검증을, 배포 전에는 `pnpm verify:full`로 완전한 검증을 수행하세요!
