# 분산 HR 시스템 - 완전 구현 가이드

## 🎯 프로젝트 개요

**LDAP 통합 분산 HR 시스템**으로 완전히 업그레이드되었습니다! 🚀

### ✅ 구현 완료된 기능들

- **🏢 LDAP 통합**: 실제 기업환경과 동일한 인증 시스템
- **📊 실시간 이벤트 버스**: Redis 기반 분산 메시징
- **💾 다중 데이터베이스**: SQLite + Neo4j + Redis
- **🔄 자동 동기화**: LDAP ↔ 로컬 DB 실시간 동기화
- **🐳 Docker 완전 지원**: 모든 인프라 컨테이너화
- **📈 모니터링**: Portainer + Redis Commander

## 📋 테스트 사용자 계정

### LDAP 테스트 계정들

| 사용자명       | 비밀번호      | 이름         | 부서        | 직책                |
| -------------- | ------------- | ------------ | ----------- | ------------------- |
| `john.doe`     | `password123` | John Doe     | Engineering | Senior Developer    |
| `jane.smith`   | `password123` | Jane Smith   | Engineering | Engineering Manager |
| `bob.wilson`   | `password123` | Bob Wilson   | Product     | Product Manager     |
| `alice.chen`   | `password123` | Alice Chen   | Design      | UX Designer         |
| `mike.johnson` | `password123` | Mike Johnson | Engineering | DevOps Engineer     |

### 관리자 계정

- **LDAP Admin**: `cn=admin,dc=company,dc=com` / `password`

## 🔗 서비스 URL들

### 애플리케이션 서비스

- **HR Resource Service**: http://localhost:3001
- **Matching Engine**: http://localhost:3002
- **Verification Service**: http://localhost:3003
- **Edge Agent**: http://localhost:3004

### 인프라 서비스

- **Neo4j Browser**: http://localhost:7474 (neo4j/password)
- **Portainer**: http://localhost:9000 (컨테이너 관리)
- **Redis Commander**: http://localhost:8081 (Redis 관리)

## 🏗️ 아키텍처 구조

```
┌─────────────────────────────────────────────┐
│            Client Applications              │
└─────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────┐
│              API Gateway                    │
│            (Load Balancer)                  │
└─────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────┐
│           Microservices Layer               │
│                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │   HR    │  │Matching │  │  Edge   │     │
│  │Resource │  │ Engine  │  │ Agent   │     │
│  └─────────┘  └─────────┘  └─────────┘     │
└─────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────┐
│            Event Bus (Redis)                │
│         (Distributed Messaging)             │
└─────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────┐
│              Data Layer                     │
│                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │  LDAP   │  │ Neo4j   │  │ SQLite  │     │
│  │(Users)  │  │(Graph)  │  │(Local)  │     │
│  └─────────┘  └─────────┘  └─────────┘     │
└─────────────────────────────────────────────┘
```

## 🧪 테스트 시나리오

# 1. 테스트 데이터 생성

node test-data-generator.js

# 2. 전체 테스트 실행

node test-simulation.js full

# 3. 빠른 테스트만 실행

node test-simulation.js quick

# 4. 성능 테스트만 실행

node test-simulation.js perf

## 🔄 서비스 간 협력 시나리오 예시

# 장애 발생 시 자동 대응 플로우:

Edge Agent가 서버 다운 감지
자동 복구 시도 → 실패
매칭 엔진에 인력 지원 요청
인적 자원 관리에서 최적 직원 탐색
블록체인에서 해당 직원의 자격 검증
자격 부족 또는 가용 인력 없음 감지
아웃소싱 서비스에서 외부 전문가 자동 조달
실시간 모니터링으로 해결 과정 추적

# 예측적 리소스 배치 시나리오:

데이터 레이어에서 과거 패턴 분석
매칭 엔진이 다음 주 장애 예측
인적 자원 관리에서 사전 대기 인력 배정
Edge Agent들에게 예측 정보 전파
실제 장애 발생 시 즉시 대응

## 📁 프로젝트 구조

```
solace-typescript-HCM/
├── src/
│   ├── shared/                 # 공통 모듈
│   │   ├── eventbus.ts        # 이벤트 버스
│   │   ├── ldap.ts            # LDAP 서비스
│   │   └── database.ts        # 데이터베이스 유틸
│   └── services/
│       └── hr-resource/       # HR 리소스 서비스
│           └── index.ts
├── development/
│   └── mock-ldap-server.ts    # Mock LDAP 서버
├── data/                      # SQLite 데이터베이스 파일
├── docker-compose.yml         # Docker 인프라 정의
├── .env                       # 환경 변수
└── package.json               # 의존성 및 스크립트
```
