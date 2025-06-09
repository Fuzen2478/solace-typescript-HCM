# Docker Setup and Usage Guide

이 문서는 HCM (Human Capital Management) 시스템을 Docker로 실행하는 방법을 설명합니다.

## 🐳 Docker 구성 개요

### 📊 Infrastructure Services
- **Redis** (포트: 6379) - 캐시 및 세션 스토어
- **Neo4j** (포트: 7474, 7687) - 그래프 데이터베이스
- **PostgreSQL** (포트: 5432) - 관계형 데이터베이스
- **OpenLDAP** (포트: 389, 636) - 디렉토리 서비스
- **Solace PubSub+** (포트: 8080, 55555, 등) - 메시지 브로커

### 🏗️ Application Services
- **API Gateway** (포트: 3001) - 주요 API 엔드포인트
- **HR Resource** (포트: 3002) - 인사 관리 서비스
- **Matching Engine** (포트: 3003) - 매칭 알고리즘 서비스
- **Verification** (포트: 3004) - 신원 확인 서비스
- **Edge Agent** (포트: 3005) - 엣지 컴퓨팅 서비스

### 🛠️ Management Services
- **Nginx** (포트: 80, 443) - 리버스 프록시 및 로드 밸런서
- **Portainer** (포트: 9001) - Docker 관리 UI
- **Redis Commander** (포트: 8082) - Redis 관리 UI
- **LDAP Admin** (포트: 8083) - LDAP 관리 UI

## 🚀 빠른 시작

### 1. 환경 설정
```bash
# 환경 변수 파일 복사
cp .env.docker .env
```

### 2. 모든 서비스 시작
```bash
# 모든 서비스 빌드하고 시작
npm run docker:dev:all

# 또는 직접 명령어
docker-compose up -d --build
```

### 3. 헬스체크 실행
```bash
# Windows
npm run health-check

# Linux/Mac
npm run health-check:bash
```

### 4. 서비스 접속
메인 대시보드: http://localhost

## 📋 주요 명령어

### 🔨 빌드 및 실행
```bash
# 서비스 빌드
npm run docker:build

# 캐시 없이 전체 빌드
npm run docker:build:all

# 빌드하고 시작
npm run docker:up:build

# 서비스 시작 (빌드 없이)
npm run docker:up

# 서비스 중지
npm run docker:down

# 개발 환경 (빌드 + 시작)
npm run docker:dev:all
```

### 📊 인프라만 운영 (하이브리드 개발)
```bash
# 인프라 서비스만 시작
npm run docker:dev:infra

# 로컬에서 애플리케이션 개발
npm run dev:all
```

### 🏗️ 애플리케이션만 운영
```bash
# 애플리케이션 서비스만 시작
npm run docker:dev:apps
```

### 📝 로그 확인
```bash
# 모든 서비스 로그
npm run docker:logs

# 애플리케이션 서비스만 로그
npm run docker:logs:app

# 인프라 서비스만 로그
npm run infra:logs

# 특정 서비스 로그
docker-compose logs -f api-gateway
docker-compose logs -f solace
docker-compose logs -f neo4j
```

### 🔄 재시작
```bash
# 모든 서비스 재시작
npm run docker:restart

# 애플리케이션 서비스만 재시작
npm run docker:restart:app

# 특정 서비스 재시작
docker-compose restart api-gateway
docker-compose restart solace
```

### 🧹 정리
```bash
# 컨테이너와 볼륨 삭제
npm run docker:clean

# Docker 시스템 정리
npm run docker:prune

# 모든 컨테이너 중지
docker-compose down
```

## 🌐 접속 URL

### 🎯 통합 대시보드 (Nginx 프록시)
- **메인 대시보드**: http://localhost
- **API Gateway**: http://localhost/api
- **HR Service**: http://localhost/hr
- **Matching Engine**: http://localhost/matching
- **Verification**: http://localhost/verification
- **Edge Agent**: http://localhost/edge

### 🛠️ 관리 도구 (Nginx 프록시)
- **Solace Manager**: http://localhost/solace
- **Neo4j Browser**: http://localhost/neo4j
- **LDAP Admin**: http://localhost/ldap-admin
- **Redis Commander**: http://localhost/redis
- **Portainer**: http://localhost/portainer

### 🔗 직접 접속 (개발용)
- **API Gateway**: http://localhost:3001
- **HR Resource**: http://localhost:3002
- **Matching Engine**: http://localhost:3003
- **Verification**: http://localhost:3004
- **Edge Agent**: http://localhost:3005
- **Solace Management**: http://localhost:8080
- **Neo4j Browser**: http://localhost:7474
- **Portainer**: http://localhost:9001
- **Redis Commander**: http://localhost:8082
- **LDAP Admin**: http://localhost:8083

## 🔧 개발 모드

### 💡 하이브리드 개발 (권장)
인프라는 Docker로, 애플리케이션은 로컬에서 개발:

```bash
# 1. 인프라 서비스만 시작
npm run docker:dev:infra

# 2. 로컬에서 애플리케이션 개발
npm run dev:all
```

**장점:**
- 빠른 코드 변경 및 테스트
- 로컬 디버깅 가능
- 안정적인 인프라 환경

### 🐳 완전 Docker 개발
모든 서비스를 Docker로 실행:

```bash
# 모든 서비스 Docker로 실행
npm run docker:dev:all
```

**장점:**
- 프로덕션 환경과 동일
- 완전한 격리
- 다른 개발자와 동일한 환경

### 🧪 테스트 환경
Mock LDAP 서버 포함:

```bash
# 테스트 프로파일로 실행 (Mock LDAP 포함)
docker-compose --profile testing up -d
```

## 🐛 트러블슈팅

### ❗ 일반적인 문제

1. **포트 충돌**
   ```bash
   # 사용 중인 포트 확인 (Windows)
   netstat -an | findstr :3001
   
   # 사용 중인 포트 확인 (Linux/Mac)
   lsof -i :3001
   
   # 프로세스 종료 (Windows)
   taskkill /PID <PID> /F
   
   # 프로세스 종료 (Linux/Mac)
   kill -9 <PID>
   ```

2. **컨테이너가 시작되지 않음**
   ```bash
   # 로그 확인
   docker-compose logs [service-name]
   
   # 컨테이너 상태 확인
   docker-compose ps
   
   # 실패한 컨테이너 재시작
   docker-compose restart [service-name]
   ```

3. **볼륨 권한 문제**
   ```bash
   # 볼륨 삭제 후 재생성
   npm run docker:clean
   npm run docker:up:build
   ```

4. **메모리 부족**
   ```bash
   # Docker Desktop에서 메모리 할당량 증가
   # Settings > Resources > Memory (최소 4GB 권장)
   ```

5. **네트워크 연결 문제**
   ```bash
   # 네트워크 재생성
   docker network rm hcm-network
   docker-compose up -d
   ```

### 🔍 로그 분석
```bash
# 전체 시스템 로그
npm run docker:logs

# 특정 서비스 로그
docker-compose logs -f solace
docker-compose logs -f neo4j
docker-compose logs -f api-gateway

# 에러만 필터링
docker-compose logs | grep -i error
```

### 🩺 디버깅 명령어
```bash
# 컨테이너 내부 접속
docker exec -it hcm-api-gateway /bin/sh
docker exec -it neo4j /bin/bash

# 네트워크 연결 테스트
docker exec -it hcm-api-gateway ping neo4j
docker exec -it hcm-api-gateway wget -qO- http://redis:6379

# 디스크 사용량 확인
docker system df
```

## 📊 모니터링

### 🎛️ Portainer 사용법
1. http://localhost/portainer 접속
2. 초기 관리자 계정 생성
3. Local Docker 환경 선택
4. 컨테이너, 이미지, 볼륨, 네트워크 관리

### 📈 Redis Commander 사용법
1. http://localhost/redis 접속
2. Redis 데이터 실시간 확인 및 관리
3. 키-값 쌍 조회 및 수정

### 🕸️ Neo4j Browser 사용법
1. http://localhost/neo4j 접속
2. 로그인: neo4j / password
3. 그래프 데이터 시각화 및 Cypher 쿼리 실행

### 📧 Solace PubSub+ Manager
1. http://localhost/solace 접속
2. 로그인: admin / admin
3. 메시지 큐, 토픽, 클라이언트 관리

### 📂 LDAP Admin
1. http://localhost/ldap-admin 접속
2. 서버: openldap
3. 디렉토리 구조 관리 및 사용자 관리

## 🔐 보안 설정

### 🚨 프로덕션 환경 주의사항

1. **비밀번호 변경**
   ```bash
   # .env.docker 파일에서 모든 기본 비밀번호 변경
   NEO4J_PASSWORD=your-secure-password
   POSTGRES_PASSWORD=your-secure-password
   REDIS_PASSWORD=your-secure-password
   LDAP_ADMIN_PASSWORD=your-secure-password
   ```

2. **포트 보안**
   ```yaml
   # docker-compose.yaml에서 불필요한 포트 노출 제거
   # ports:
   #   - "5432:5432"  # PostgreSQL을 외부에서 접근 불가
   ```

3. **SSL/TLS 설정**
   ```bash
   # SSL 인증서 생성 및 Nginx HTTPS 설정
   mkdir -p nginx/certs
   # SSL 인증서 파일 추가
   ```

### 💾 데이터 백업
```bash
# PostgreSQL 백업
docker exec hcm-postgres pg_dump -U postgres hcm_db > backup_$(date +%Y%m%d).sql

# Neo4j 백업
docker exec neo4j neo4j-admin backup --backup-dir=/tmp/backup

# Redis 백업
docker exec hcm-redis redis-cli --rdb /data/backup.rdb

# 모든 볼륨 백업
docker run --rm -v hcm_postgres_data:/data -v $(pwd):/backup ubuntu tar czf /backup/postgres_backup.tar.gz -C /data .
```

## 📈 성능 최적화

### 🎯 리소스 할당
```yaml
# docker-compose.yaml에 리소스 제한 추가
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
    reservations:
      memory: 1G
      cpus: '0.5'
```

### ⚡ 캐시 최적화
- Docker 빌드 캐시 활용
- Multi-stage 빌드로 이미지 크기 최소화
- .dockerignore로 불필요한 파일 제외
- 자주 변경되지 않는 레이어를 먼저 배치

### 🔄 자동 재시작 정책
```yaml
restart: unless-stopped  # 수동 중지가 아닌 경우 자동 재시작
```

## 🆘 지원 및 도움말

### 📞 문제 해결 순서
1. **헬스체크 실행**: `npm run health-check`
2. **로그 확인**: `npm run docker:logs`
3. **컨테이너 상태**: `docker-compose ps`
4. **리소스 확인**: `docker stats`
5. **재시작**: `docker-compose restart [service]`

### 📚 추가 자료
- [Docker Compose 공식 문서](https://docs.docker.com/compose/)
- [Solace PubSub+ 문서](https://docs.solace.com/)
- [Neo4j 운영 가이드](https://neo4j.com/docs/)
- [OpenLDAP 관리 가이드](https://www.openldap.org/doc/)

### 🐛 이슈 리포트
문제 발생 시 다음 정보와 함께 GitHub Issues에 등록:
- 운영체제 및 Docker 버전
- 에러 로그 (`docker-compose logs`)
- 재현 단계
- 예상 동작과 실제 동작

---

**💡 팁**: 개발 시작 전 `npm run health-check`로 모든 서비스가 정상인지 확인하세요!
