# 🚀 HCM 분산 시스템 빠른 시작 가이드

## ⚡ 1분 만에 시작하기

### 🔥 **즉시 실행 (Docker 권장)**

```bash
# 1. 전체 시스템 한번에 시작
docker-compose up -d --build

# 2. 시스템 상태 확인
docker-compose ps

# 3. 통합 테스트 실행
node scripts/test-integration.js
```

### 🎯 **핵심 URL 접속**

| 서비스              | URL                   | 설명                       |
| ------------------- | --------------------- | -------------------------- |
| **API Gateway**     | http://localhost:3000 | 통합 API 진입점            |
| **HR Resource**     | http://localhost:3001 | 인력 관리                  |
| **Matching Engine** | http://localhost:3002 | AI 매칭                    |
| **Verification**    | http://localhost:3003 | 실시간 검증                |
| **Edge Agent**      | http://localhost:3004 | 분산 동기화                |
| **Outsourcing**     | http://localhost:3006 | 외부 인력 확보             |
| **Portainer**       | http://localhost:9000 | 시스템 모니터링            |
| **Neo4j**           | http://localhost:7474 | 그래프 DB (neo4j/password) |

---

## 🛠️ 개발 환경 설정

### 📋 **필수 요구사항**

- **Node.js**: 18+ (권장: 20.x)
- **Docker**: 20+ & Docker Compose
- **pnpm**: 최신 버전 (권장)
- **메모리**: 최소 4GB (권장: 8GB+)

### 🔧 **개발 모드 실행**

```bash
# 1. 의존성 설치
pnpm install

# 2. 인프라만 Docker로 시작
pnpm docker:infra

# 3. 모든 서비스 개발 모드로 시작
pnpm dev:all

# 또는 개별 서비스 시작
pnpm dev:gateway     # API Gateway
pnpm dev:hr          # HR Resource
pnpm dev:matching    # Matching Engine
pnpm dev:verification # Verification
pnpm dev:edge        # Edge Agent
pnpm dev:outsourcing # Outsourcing
```

---

## 🧪 테스트 및 검증

### 🎯 **통합 테스트 실행**

```bash
# 포괄적 통합 테스트 (권장)
node scripts/test-integration.js

# Jest 기반 테스트
pnpm test
pnpm test:integration
pnpm test:coverage

# 성능 테스트
pnpm test:performance
```

### 📊 **예상 테스트 결과**

```bash
🚀 Starting HCM System Integration Tests...

📊 Checking Service Health...
✓ API Gateway: healthy
✓ HR Resource: healthy
✓ Matching Engine: healthy
✓ Verification Service: healthy
✓ Edge Agent: healthy
✓ Outsourcing Service: healthy

📈 Health Summary: 6/6 services healthy

🧪 Testing CRDT Functionality...
✓ CRDT document initialized
✓ Employee added to CRDT
✓ Assignment created in CRDT
✓ Available employees: 1

🔍 Testing Verification Service...
✓ Certification verification: PASSED
  Score: 85/100
✓ Verification queue status: 0 pending

🌐 Testing Outsourcing Service...
✓ Skill matching: 3 providers found
  Top match: TechExperts (Score: 89)
✓ Outsourcing request: 2 proposals received
  Best match: FreelancerPro - $1,800

⚡ Testing Edge Agent Tasks...
✓ Data sync task submitted: task-uuid-123
✓ Task status: completed
✓ Health check initiated: health-uuid-456

🎉 Integration tests completed!
```

---

## 🎯 핵심 기능 체험

### 1. **CRDT 분산 동기화 체험**

```bash
# Edge Agent CRDT 문서 초기화
curl -X POST http://localhost:3004/crdt/documents   -H "Content-Type: application/json"   -d '{"docId": "test-hr-doc"}'

# 직원 추가
curl -X POST http://localhost:3004/crdt/documents/test-hr-doc/employees   -H "Content-Type: application/json"   -d '{
    "id": "emp-001",
    "name": "김개발자",
    "email": "kim@company.com",
    "department": "engineering",
    "skills": ["JavaScript", "React", "Node.js"]
  }'

# 가용한 직원 조회
curl http://localhost:3004/crdt/documents/test-hr-doc/employees/available
```

### 2. **AI 매칭 시스템 체험**

```bash
# 작업 생성 및 자동 매칭
curl -X POST http://localhost:3002/tasks   -H "Content-Type: application/json"   -d '{
    "title": "React 웹앱 개발",
    "description": "신규 웹 애플리케이션 개발",
    "requiredSkills": ["React", "JavaScript"],
    "urgency": "high",
    "estimatedHours": 40
  }'

# 매칭 결과 확인
curl http://localhost:3002/tasks/{task-id}/matches
```

### 3. **실시간 검증 체험**

```bash
# 자격증 실시간 검증
curl -X POST http://localhost:3003/verify/real-time   -H "Content-Type: application/json"   -d '{
    "type": "certification",
    "employeeId": "emp-001",
    "data": {
      "issuer": "AWS",
      "certificationName": "AWS Solutions Architect",
      "issueDate": "2023-01-15",
      "expiryDate": "2026-01-15",
      "verificationHash": "abc123..."
    }
  }'
```

### 4. **외부 인력 확보 체험**

```bash
# 스킬 기반 매칭
curl -X POST http://localhost:3006/match/skills   -H "Content-Type: application/json"   -d '{
    "requiredSkills": ["Python", "Django"],
    "urgency": "high",
    "maxBudget": 80
  }'

# 아웃소싱 요청
curl -X POST http://localhost:3006/requests   -H "Content-Type: application/json"   -d '{
    "requiredSkills": ["Python", "Django"],
    "estimatedHours": 40,
    "maxBudget": 2000,
    "description": "Django 웹 애플리케이션 개발"
  }'
```

---

## 📊 모니터링 및 관리

### 🖥️ **대시보드 접속**

1. **Portainer 대시보드**: http://localhost:9000
2. **Neo4j Browser**: http://localhost:7474
   - 사용자: neo4j / 비밀번호: password

### 📋 **유용한 명령어**

```bash
docker-compose ps
docker-compose logs -f
docker-compose logs -f hr-resource
docker-compose logs | grep "ERROR"
docker-compose down
docker-compose restart
docker-compose down -v
docker-compose up -d --build
```

### 🔍 **문제 해결**

#### 포트 충돌 해결

```bash
netstat -tulpn | grep :3000
lsof -i :3000
kill -9 <PID>
```

#### 메모리 부족 해결

```bash
docker system prune -a
docker volume prune
```

---

## 🎮 데모 시나리오

### 긴급 장애 대응, 신규 프로젝트 인력 배치, 실시간 조직 변경

(본문 생략, 위 내용 포함됨)

---

## 📚 추가 자료

- [📋 완성 보고서](docs/IMPLEMENTATION_COMPLETE.md)
- [🏗️ 아키텍처 가이드](docs/ARCHITECTURE.md)
- [🔧 API 문서](docs/API_REFERENCE.md)
- [🧪 테스트 가이드](docs/TESTING.md)

---

## 🎊 축하합니다!

**세계 최초 인력 자원화 분산 시스템**을 성공적으로 실행하셨습니다!

---

## 📞 지원 및 문의

- 로그 확인: `docker-compose logs -f`
- 상태 체크: `docker-compose ps`
- 통합 테스트: `node scripts/test-integration.js`
- 시스템 재시작: `docker-compose restart`

**Happy Coding! 🎉**
