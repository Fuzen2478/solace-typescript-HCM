# 인적 자본 관리 기반 분산 시스템 (HCM)

## 🎯 프로젝트 개요

**인력을 시스템 자원으로 활용하는 혁신적인 분산 시스템**입니다. 조직의 인적 자원을 동적으로 할당 가능한 컴퓨팅 리소스로 취급하여 자동화된 인력 배치와 장애 대응을 실현합니다.

### ✨ 핵심 혁신 요소

- **🔄 인력의 자원화**: 전통적인 고정 조직도에서 벗어나 동적 리소스 풀로 인력 관리
- **🤖 자율적 분산 의사결정**: Edge Agent들이 독립적으로 판단하고 대응
- **🔐 신뢰성 있는 자격 검증**: 블록체인 기반 불변 이력 관리
- **🎯 예측적 리소스 배치**: AI 기반 인력 수요 예측 및 사전 배치

## 🏗️ 시스템 아키텍처

```
📦 HCM 분산 시스템
├── 📊 데이터 레이어 (LDAP/Graph DB)
├── 👥 인적 자원 관리 서비스
├── 🔐 블록체인 검증 레이어 (Hyperledger Fabric)
├── 🤖 Edge Agent 시스템 (CRDT 기반)
├── 🎯 매칭 엔진 (ML 기반)
└── 🌐 외부 아웃소싱 연동
```

## 📂 프로젝트 구조

```
solace-typescript-HCM/
├── 📁 src/                     # 소스 코드
│   ├── services/               # 마이크로서비스들
│   │   ├── api-gateway/        # API 게이트웨이
│   │   ├── hr-resource/        # 인적 자원 관리
│   │   ├── matching-engine/    # 매칭 엔진
│   │   ├── verification/       # 블록체인 검증
│   │   └── edge-agent/         # 엣지 에이전트
│   └── shared/                 # 공통 모듈
├── 📁 scripts/                 # 운영 스크립트
│   ├── development/            # 개발용 스크립트
│   ├── testing/               # 테스트 스크립트
│   └── utilities/             # 유틸리티 스크립트
├── 📁 docs/                    # 프로젝트 문서
├── 📁 configs/                 # 설정 파일들
│   └── docker/                # Docker 설정
├── 📁 tests/                   # 테스트 코드
└── 📁 data/                    # 데이터 파일
```

## 🚀 빠른 시작

### 1. 환경 설정
```bash
# 의존성 설치
pnpm install

# 환경 설정
cp .env.local .env
```

### 2. 개발 환경 실행
```bash
# 인프라 서비스 시작
pnpm docker:infra

# 모든 서비스 개발 모드로 시작
pnpm dev:all

# 개별 서비스 시작
pnpm dev:hr          # HR 리소스 서비스
pnpm dev:matching    # 매칭 엔진
pnpm dev:verification # 검증 서비스
pnpm dev:edge        # 엣지 에이전트
```

### 3. Docker로 전체 시스템 실행
```bash
# 전체 시스템 시작
pnpm docker:dev

# 상태 확인
pnpm docker:status

# 로그 확인
pnpm docker:logs
```

## 🧪 테스트

### 기본 테스트
```bash
# 단위 테스트
pnpm test

# 통합 테스트
pnpm test:integration

# 커버리지 포함 테스트
pnpm test:coverage
```

### 대규모 시뮬레이션
```bash
# 테스트 데이터 생성 (프로젝트 루트에서)
node test-data-generator.js

# 전체 시뮬레이션 실행
node test-simulation.js full

# 빠른 테스트
node test-simulation.js quick

# 성능 테스트만
node test-simulation.js perf
```

## 🎯 핵심 서비스

### 📊 데이터 레이어
- LDAP/Graph DB 기반 인력 정보 저장
- 조직도, 스킬, 가용성 데이터 실시간 관리

### 👥 인적 자원 관리 서비스
- 인력을 "자원 풀"로 추상화
- 실시간 가용성 추적 및 역량 평가

### 🔐 블록체인 검증 레이어
- Hyperledger Fabric 기반 자격 검증
- 불변성 보장된 이력 관리

### 🤖 Edge Agent 시스템
- CRDT 기반 분산 상태 동기화
- 자율적 장애 감지 및 대응

### 🎯 매칭 엔진
- ML 기반 인력-업무 최적 매칭
- 동적 권한 및 알림 라우팅

### 🌐 외부 아웃소싱 연동
- 내부 인력 부족 시 자동 외부 리소스 확보
- 비용 최적화된 파트너 선택

## 🛠️ 유틸리티 스크립트

### 개발 도구
```bash
# 시스템 상태 확인
pnpm health-check

# 프로젝트 설정
pnpm setup

# 데모 실행
pnpm demo
```

### 정리 도구
```bash
# 빌드 아티팩트 정리
pnpm clean
```

## 📊 모니터링 및 로그

### 서비스 URL
- **API Gateway**: http://localhost:3000
- **HR Resource**: http://localhost:3001  
- **Matching Engine**: http://localhost:3002
- **Verification**: http://localhost:3003
- **Edge Agent**: http://localhost:3004

### 인프라 대시보드
- **Neo4j Browser**: http://localhost:7474
- **Redis Commander**: http://localhost:8081
- **Portainer**: http://localhost:9000

## 🔄 시나리오 예시

### 장애 발생 시 자동 대응
1. Edge Agent가 서버 다운 감지
2. 자동 복구 시도 → 실패
3. 매칭 엔진에 인력 지원 요청
4. 인적 자원 관리에서 최적 직원 탐색
5. 블록체인에서 자격 검증
6. 내부 인력 부족 시 아웃소싱 자동 조달

### 예측적 리소스 배치
1. 데이터 레이어에서 과거 패턴 분석
2. 매칭 엔진이 다음 주 장애 예측
3. 인적 자원 관리에서 사전 대기 인력 배정
4. Edge Agent들에게 예측 정보 전파
5. 실제 장애 발생 시 즉시 대응

## 🎯 8주 PoC 개발 계획

### Phase 1: 환경 구성 (1-2주)
- [x] 프로젝트 구조 설정
- [x] Docker 환경 구성
- [x] 기본 서비스 템플릿 구축

### Phase 2: 핵심 서비스 개발 (3-5주)
- [ ] 데이터 레이어 구현
- [ ] 인적 자원 관리 서비스
- [ ] 매칭 엔진 개발
- [ ] Edge Agent 시스템

### Phase 3: 통합 및 테스트 (6-7주)
- [ ] 서비스 간 통합
- [ ] 블록체인 검증 연동
- [ ] 대규모 테스트 시나리오

### Phase 4: 최적화 및 완성 (8주)
- [ ] 성능 최적화
- [ ] 문서화
- [ ] 데모 준비

## 🔧 개발 환경

### 필수 요구사항
- Node.js 18+
- Docker & Docker Compose
- pnpm (패키지 매니저)

### 권장 도구
- Visual Studio Code
- Docker Desktop
- Postman (API 테스트)

## 📚 문서

상세한 문서들은 `docs/` 폴더에서 확인하실 수 있습니다:

- [Docker 가이드](docs/DOCKER_GUIDE.md)
- [실행 가이드](docs/EXECUTION_GUIDE.md)
- [테스트 가이드](docs/TEST_GUIDE.md)
- [검증 가이드](docs/VERIFICATION_GUIDE.md)

## 🤝 기여하기

1. 이 저장소를 포크하세요
2. 피처 브랜치를 생성하세요 (`git checkout -b feature/AmazingFeature`)
3. 변경사항을 커밋하세요 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 푸시하세요 (`git push origin feature/AmazingFeature`)
5. Pull Request를 열어주세요

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 지원

질문이나 이슈가 있으시면 GitHub Issues를 통해 문의해 주세요.

---

**🚀 혁신적인 인적 자본 관리 시스템으로 조직의 효율성을 극대화하세요!**