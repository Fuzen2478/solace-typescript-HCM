# 🔍 HCM 시스템 완전 검증 가이드 (Docker 없이)

## 📋 **Phase 1: 로컬 환경 설정 및 기본 인프라 (45분)**

### ✅ **1.1 Node.js 환경 확인**
- [ ] Node.js 버전 확인 (18+ 권장)
  ```bash
  node --version
  npm --version
  ```
- [ ] 만약 Node.js 없다면 설치: https://nodejs.org/

### ✅ **1.2 프로젝트 의존성 설치**
- [ ] 루트 디렉터리에서 패키지 설치
  ```bash
  cd C:\Users\pp\Projects\solace-typescript-HCM
  npm install
  ```
- [ ] 추가 필요 패키지 설치
  ```bash
  npm install bcrypt @types/bcrypt
  npm install crypto
  ```
- [ ] TypeScript 컴파일 테스트
  ```bash
  npx tsc --noEmit
  ```
  - **오류 발생시**: 각 파일의 import 문제 수정

### ✅ **1.3 로컬 데이터베이스 설치 및 설정**

#### **Neo4j 로컬 설치**
- [ ] Neo4j Desktop 다운로드: https://neo4j.com/download/
- [ ] 설치 후 새 데이터베이스 생성
  - **Name**: `hcm-database`
  - **Password**: `password`
  - **포트**: 7687 (bolt), 7474 (http)
- [ ] 데이터베이스 시작
- [ ] 브라우저에서 접속 확인: http://localhost:7474
  - **Username**: `neo4j`
  - **Password**: `password`

#### **Redis 로컬 설치 (Windows)**
- [ ] Redis for Windows 다운로드: https://github.com/microsoftarchive/redis/releases
- [ ] 또는 WSL2에서 Redis 설치:
  ```bash
  wsl
  sudo apt update
  sudo apt install redis-server
  redis-server --daemonize yes
  ```
- [ ] Redis 연결 테스트
  ```bash
  redis-cli ping
  # 응답: PONG
  ```

### ✅ **1.4 환경 변수 설정**
- [ ] `.env` 파일 생성 또는 확인
  ```bash
  # 루트 디렉터리에 .env 파일 생성
  ```
- [ ] 환경 변수 내용:
  ```env
  # Database
  NEO4J_URI=bolt://localhost:7687
  NEO4J_USER=neo4j
  NEO4J_PASSWORD=password
  
  # Redis
  REDIS_HOST=localhost
  REDIS_PORT=6379
  
  # Service Ports (포트 충돌 해결)
  API_GATEWAY_PORT=3000
  GATEWAY_WS_PORT=3006
  HR_SERVICE_PORT=3001
  MATCHING_ENGINE_PORT=3002
  MATCHING_WS_PORT=3003
  VERIFICATION_SERVICE_PORT=3005  # 3003에서 변경
  EDGE_AGENT_PORT=3004
  EDGE_WS_PORT=3007  # 3005에서 변경
  
  # LDAP (Mock)
  LDAP_URL=ldap://localhost:389
  LDAP_BIND_DN=cn=admin,dc=company,dc=com
  LDAP_BIND_PASSWORD=password
  LDAP_BASE_DN=dc=company,dc=com
  
  # Security
  VERIFICATION_SECRET=your-super-secret-key-here
  ```

### ✅ **1.5 포트 충돌 해결**
- [ ] Verification Service 포트 변경
  ```typescript
  // src/services/verification/index.ts 수정
  const PORT = process.env.VERIFICATION_SERVICE_PORT || 3005;
  ```
- [ ] Edge Agent WebSocket 포트 변경
  ```typescript
  // src/services/edge-agent/index.ts 수정
  const wsPort = parseInt(process.env.EDGE_WS_PORT!) || 3007;
  ```

## 📋 **Phase 2: 코드 수정 및 Mock 설정 (30분)**

### ✅ **2.1 LDAP Mock 처리**
- [ ] HR Service LDAP 부분 임시 비활성화
  ```typescript
  // src/services/hr-resource/index.ts에서 LDAP 관련 코드 주석 처리
  
  // LDAP Client 초기화 부분을 Mock으로 대체
  /*
  let ldapClient: ldap.Client;
  const createLdapClient = () => {
    // ... LDAP 코드
  };
  createLdapClient();
  */
  
  // Mock LDAP client
  const mockLdapClient = {
    bind: (dn: string, password: string, callback: Function) => callback(null),
    add: (dn: string, entry: any, callback: Function) => callback(null),
    search: (base: string, options: any, callback: Function) => callback(null, { entries: [] })
  };
  ```

### ✅ **2.2 Fabric 관련 코드 제거 (Verification Service)**
- [ ] Verification Service에서 Hyperledger Fabric 관련 import 제거
  ```typescript
  // src/services/verification/index.ts 수정
  // 다음 라인들 주석 처리:
  /*
  import { Gateway, Wallets, X509Identity } from 'fabric-network';
  import FabricCAServices from 'fabric-ca-client';
  */
  ```

### ✅ **2.3 Import 오류 수정**
- [ ] crypto import 수정 (Node.js 내장 모듈)
  ```typescript
  // src/services/verification/index.ts
  import crypto from 'crypto';  // import * as crypto 대신
  ```

## 📋 **Phase 3: 개별 서비스 실행 테스트 (60분)**

### ✅ **3.1 HR Resource Service 실행 및 테스트**

#### **실행**
- [ ] 새 터미널 1 열기
  ```bash
  cd C:\Users\pp\Projects\solace-typescript-HCM
  npm run dev:hr
  ```

#### **실행 중 확인사항**
- [ ] 로그에서 다음 메시지 확인:
  ```
  HR Resource Service running on port 3001
  Neo4j connection established
  Redis connection: ready
  Database schema initialized successfully
  ```

#### **헬스체크 테스트**
- [ ] 새 터미널에서 테스트
  ```bash
  curl http://localhost:3001/health
  ```
- [ ] 예상 응답:
  ```json
  {
    "status": "healthy",
    "timestamp": "2025-01-XX...",
    "services": {
      "neo4j": "connected",
      "redis": "ready"
    }
  }
  ```

#### **기본 API 테스트**
- [ ] 직원 생성 테스트
  ```bash
  curl -X POST http://localhost:3001/employees \
    -H "Content-Type: application/json" \
    -d '{
      "name": "김철수",
      "email": "kim@test.com",
      "department": "Engineering",
      "skills": [
        {
          "name": "JavaScript",
          "level": "advanced",
          "yearsOfExperience": 5,
          "verifiedBy": "system"
        },
        {
          "name": "Node.js", 
          "level": "expert",
          "yearsOfExperience": 4,
          "verifiedBy": "system"
        }
      ],
      "availability": {
        "available": true,
        "capacity": 80,
        "scheduledHours": 32,
        "maxHoursPerWeek": 40
      },
      "location": "Seoul",
      "role": "Senior Developer",
      "workload": 0,
      "maxHoursPerWeek": 40,
      "timezone": "Asia/Seoul",
      "performanceRating": 4.2,
      "completionRate": 88,
      "contactInfo": {
        "phone": "010-1234-5678",
        "address": "서울시 강남구"
      },
      "emergencyContact": {
        "name": "김영희",
        "relationship": "배우자",
        "phone": "010-9876-5432"
      }
    }'
  ```
- [ ] 응답에서 직원 ID 기록: `________________`

- [ ] 직원 목록 조회
  ```bash
  curl http://localhost:3001/employees
  ```

### ✅ **3.2 Matching Engine 실행 및 테스트**

#### **실행**
- [ ] 새 터미널 2 열기
  ```bash
  npm run dev:matching
  ```

#### **실행 중 확인사항**
- [ ] 로그 확인:
  ```
  Matching Engine Service running on port 3002
  WebSocket server running on port 3003
  Neo4j connection established
  Redis connection: ready
  ```

#### **헬스체크 테스트**
- [ ] 헬스체크
  ```bash
  curl http://localhost:3002/health
  ```

#### **매칭 테스트**
- [ ] 작업 생성 및 자동 매칭
  ```bash
  curl -X POST http://localhost:3002/tasks \
    -H "Content-Type: application/json" \
    -d '{
      "title": "REST API 개발",
      "description": "사용자 관리 시스템을 위한 REST API 구축",
      "requiredSkills": [
        {
          "name": "JavaScript",
          "level": "intermediate", 
          "mandatory": true,
          "weight": 8
        },
        {
          "name": "Node.js",
          "level": "advanced",
          "mandatory": true, 
          "weight": 9
        },
        {
          "name": "Express",
          "level": "intermediate",
          "mandatory": false,
          "weight": 6
        }
      ],
      "priority": "high",
      "estimatedHours": 24,
      "deadline": "2025-02-15T00:00:00Z",
      "remoteAllowed": true,
      "createdBy": "test-manager",
      "departmentRestriction": "Engineering"
    }'
  ```
- [ ] 응답에서 작업 ID 및 초기 매칭 결과 확인
- [ ] 작업 ID 기록: `________________`

- [ ] 매칭 결과 상세 조회
  ```bash
  curl -X POST http://localhost:3002/tasks/[작업ID]/matches \
    -H "Content-Type: application/json" \
    -d '{"maxResults": 5, "includeRisks": true}'
  ```

### ✅ **3.3 Verification Service 실행 및 테스트**

#### **실행**
- [ ] 새 터미널 3 열기
  ```bash
  npm run dev:verification
  ```

#### **실행 중 확인사항**
- [ ] 로그 확인:
  ```
  Verification Service running on port 3005
  Neo4j connection established
  Redis connection: ready
  ```

#### **헬스체크 테스트**
- [ ] 헬스체크
  ```bash
  curl http://localhost:3005/health
  ```

#### **검증 테스트**
- [ ] 인증서 추가 (위에서 생성한 직원 ID 사용)
  ```bash
  curl -X POST http://localhost:3005/certifications \
    -H "Content-Type: application/json" \
    -d '{
      "employeeId": "[위에서_기록한_직원ID]",
      "certificationName": "AWS Certified Developer Associate",
      "issuer": "Amazon Web Services",
      "issueDate": "2024-01-15T00:00:00Z",
      "expiryDate": "2027-01-15T00:00:00Z",
      "documentUrl": "https://aws.amazon.com/certification/verify/ABC123"
    }'
  ```
- [ ] 자동 검증 결과 확인 (AWS는 trusted issuer)

- [ ] 경력 이력 추가
  ```bash
  curl -X POST http://localhost:3005/work-history \
    -H "Content-Type: application/json" \
    -d '{
      "employeeId": "[직원ID]",
      "company": "Tech Startup Inc.",
      "position": "Full Stack Developer",
      "startDate": "2022-03-01T00:00:00Z",
      "endDate": "2024-12-31T00:00:00Z",
      "achievements": [
        "사용자 관리 시스템 개발",
        "API 성능 50% 향상",
        "팀 리더 역할 수행"
      ],
      "skills": ["JavaScript", "Node.js", "React", "MongoDB"],
      "technologies": ["AWS", "Docker", "Git"],
      "projects": [
        {
          "name": "User Management System",
          "description": "대규모 사용자 관리 시스템 구축",
          "role": "Lead Developer",
          "technologies": ["Node.js", "React", "MongoDB"],
          "startDate": "2022-06-01T00:00:00Z",
          "endDate": "2023-02-01T00:00:00Z",
          "achievements": ["일일 10만 사용자 처리 시스템 구축"]
        }
      ],
      "verifiedBy": "manager@techstartup.com"
    }'
  ```

- [ ] 직원 자격 정보 조회
  ```bash
  curl http://localhost:3005/employees/[직원ID]/credentials
  ```

### ✅ **3.4 Edge Agent 실행 및 테스트**

#### **실행**
- [ ] 새 터미널 4 열기
  ```bash
  npm run dev:edge
  ```

#### **실행 중 확인사항**
- [ ] 로그 확인:
  ```
  Edge Agent Service running on port 3004
  Agent ID: edge-agent-XXXXX
  Cluster: hcm-cluster
  WebSocket server running on port 3007
  Redis connection: ready
  ```

#### **헬스체크 테스트**
- [ ] 헬스체크
  ```bash
  curl http://localhost:3004/health
  ```

#### **분산 작업 테스트**
- [ ] 시스템 헬스체크 작업 제출
  ```bash
  curl -X POST http://localhost:3004/tasks \
    -H "Content-Type: application/json" \
    -d '{
      "type": "health_check",
      "payload": {
        "services": [
          "http://localhost:3001/health",
          "http://localhost:3002/health", 
          "http://localhost:3005/health"
        ]
      },
      "priority": 8
    }'
  ```
- [ ] 작업 ID 기록: `________________`

- [ ] 작업 실행 대기 (3초)
- [ ] 작업 상태 확인
  ```bash
  curl http://localhost:3004/tasks/[작업ID]
  ```

- [ ] 데이터 동기화 작업 테스트
  ```bash
  curl -X POST http://localhost:3004/tasks \
    -H "Content-Type: application/json" \
    -d '{
      "type": "data_sync",
      "payload": {
        "sourceService": "hr-resource",
        "targetService": "matching-engine", 
        "dataType": "employee_skills"
      },
      "priority": 6
    }'
  ```

### ✅ **3.5 API Gateway 실행 및 테스트**

#### **실행**
- [ ] 새 터미널 5 열기
  ```bash
  npm run dev:gateway
  ```

#### **실행 중 확인사항**
- [ ] 로그 확인:
  ```
  API Gateway running on port 3000
  WebSocket monitoring on port 3006
  Service discovery and health checking started
  ```

#### **헬스체크 테스트**
- [ ] Gateway 헬스체크
  ```bash
  curl http://localhost:3000/health
  ```

#### **서비스 레지스트리 테스트**
- [ ] 등록된 서비스 확인
  ```bash
  curl http://localhost:3000/services
  ```

#### **프록시 기능 테스트**
- [ ] Gateway를 통한 HR 서비스 접근
  ```bash
  curl http://localhost:3000/api/hr/employees
  ```

## 📋 **Phase 4: 통합 워크플로우 테스트 (30분)**

### ✅ **4.1 완전한 워크플로우 테스트**

#### **워크플로우 1: 직원 온보딩**
- [ ] Gateway를 통한 직원 온보딩 워크플로우
  ```bash
  curl -X POST http://localhost:3000/workflows/employee-onboarding \
    -H "Content-Type: application/json" \
    -d '{
      "name": "이영희",
      "email": "lee@company.com", 
      "department": "Engineering",
      "skills": [
        {"name": "Python", "level": "expert"},
        {"name": "Django", "level": "advanced"},
        {"name": "PostgreSQL", "level": "intermediate"}
      ]
    }'
  ```

#### **워크플로우 2: 작업 할당**
- [ ] 작업 할당 워크플로우
  ```bash
  curl -X POST http://localhost:3000/workflows/task-assignment \
    -H "Content-Type: application/json" \
    -d '{
      "title": "데이터베이스 최적화",
      "requiredSkills": [
        {"name": "Python", "level": "intermediate", "mandatory": true, "weight": 7},
        {"name": "PostgreSQL", "level": "advanced", "mandatory": true, "weight": 9}
      ],
      "estimatedHours": 32,
      "priority": "high"
    }'
  ```

### ✅ **4.2 자동 통합 테스트 실행**
- [ ] 통합 테스트 스크립트 실행
  ```bash
  npm run test:integration:manual
  ```
- [ ] 테스트 결과 확인
  - 각 테스트 케이스별 성공/실패 확인
  - 실패한 테스트의 오류 메시지 분석

### ✅ **4.3 실시간 기능 테스트**

#### **WebSocket 연결 테스트**
- [ ] 브라우저 개발자 도구에서 WebSocket 테스트
  ```javascript
  // 브라우저 콘솔에서 실행
  const ws = new WebSocket('ws://localhost:3003');
  ws.onopen = () => console.log('Matching Engine WebSocket 연결됨');
  ws.send(JSON.stringify({type: 'subscribe_matches'}));
  
  const edgeWs = new WebSocket('ws://localhost:3007');
  edgeWs.onopen = () => console.log('Edge Agent WebSocket 연결됨');
  edgeWs.send(JSON.stringify({type: 'get_status'}));
  ```

## 📋 **Phase 5: 성능 및 안정성 테스트 (20분)**

### ✅ **5.1 동시 요청 처리 테스트**
- [ ] 부하 테스트 (간단한 버전)
  ```bash
  # 10개의 동시 요청
  for i in {1..10}; do
    curl http://localhost:3001/health &
  done
  wait
  ```

### ✅ **5.2 메모리 및 CPU 사용량 확인**
- [ ] Windows 작업 관리자에서 Node.js 프로세스들 확인
- [ ] 각 서비스별 메모리 사용량 기록:
  - HR Service: _______ MB
  - Matching Engine: _______ MB
  - Verification Service: _______ MB
  - Edge Agent: _______ MB
  - API Gateway: _______ MB

### ✅ **5.3 응답 시간 측정**
- [ ] 각 서비스 응답 시간 측정
  ```bash
  # curl로 응답 시간 측정
  curl -w "@curl-format.txt" -s -o /dev/null http://localhost:3001/health
  ```
- [ ] curl-format.txt 파일 생성:
  ```
       time_namelookup:  %{time_namelookup}\n
          time_connect:  %{time_connect}\n
       time_appconnect:  %{time_appconnect}\n
      time_pretransfer:  %{time_pretransfer}\n
         time_redirect:  %{time_redirect}\n
    time_starttransfer:  %{time_starttransfer}\n
                       ----------\n
            time_total:  %{time_total}\n
  ```

## 📋 **Phase 6: 문제 해결 및 최적화 (시간에 따라)**

### ✅ **6.1 일반적인 문제 해결**

#### **문제: bcrypt 관련 오류**
```bash
npm uninstall bcrypt
npm install bcrypt
# 또는
npm install bcryptjs
# 그리고 import 변경: import bcrypt from 'bcryptjs';
```

#### **문제: Neo4j 연결 실패**
- [ ] Neo4j Desktop에서 데이터베이스 상태 확인
- [ ] 포트 7687, 7474가 사용 중인지 확인
- [ ] 방화벽 설정 확인

#### **문제: Redis 연결 실패**
- [ ] Redis 서버 실행 상태 확인
- [ ] Windows에서 Redis 서비스 시작
  ```bash
  # WSL에서
  sudo service redis-server start
  ```

#### **문제: 포트 이미 사용 중**
- [ ] 포트 사용 중인 프로세스 확인
  ```bash
  netstat -ano | findstr :3001
  ```
- [ ] 필요시 프로세스 종료 또는 다른 포트 사용

### ✅ **6.2 로그 분석 및 디버깅**
- [ ] 각 서비스의 로그 파일 확인:
  - `hr-resource.log`
  - `matching-engine.log`
  - `verification.log`
  - `edge-agent.log`
  - `api-gateway.log`

- [ ] ERROR 레벨 로그 확인 및 해결

### ✅ **6.3 데이터베이스 상태 확인**
- [ ] Neo4j 브라우저에서 데이터 확인
  ```cypher
  // 생성된 노드 확인
  MATCH (n) RETURN labels(n), count(n)
  
  // 직원 노드 확인
  MATCH (e:Employee) RETURN e LIMIT 5
  
  // 작업 노드 확인  
  MATCH (t:Task) RETURN t LIMIT 5
  ```

## 🎯 **최종 검증 체크리스트**

### ✅ **완전 성공 기준**
- [ ] 5개 모든 서비스가 오류 없이 실행 중
- [ ] 모든 헬스체크 API가 "healthy" 응답
- [ ] 직원 생성 → 작업 매칭 → 인증서 검증 워크플로우 완전 동작
- [ ] 통합 테스트 스크립트 90% 이상 성공
- [ ] WebSocket 실시간 통신 정상 동작
- [ ] Gateway를 통한 서비스 프록시 정상 동작
- [ ] 데이터베이스에 데이터 정상 저장

### ✅ **부분 성공 기준 (80% 목표)**
- [ ] 3개 이상 서비스 정상 실행
- [ ] 기본 CRUD 작업 정상 동작
- [ ] 핵심 워크플로우 1개 이상 동작

## ⏱️ **예상 총 소요 시간: 3-4시간**

- **Phase 1** (환경 설정): 45분
- **Phase 2** (코드 수정): 30분  
- **Phase 3** (개별 서비스): 60분
- **Phase 4** (통합 테스트): 30분
- **Phase 5** (성능 테스트): 20분
- **Phase 6** (문제 해결): 15-60분

## 💡 **Pro Tips**

1. **각 단계마다 결과를 기록**하세요
2. **오류 발생시 즉시 로그 확인**하세요
3. **한 번에 모든 서비스를 실행하지 말고 하나씩** 확인하세요
4. **브라우저 개발자 도구**를 활용해 WebSocket 연결을 확인하세요
5. **Postman** 같은 API 테스트 도구를 사용하면 더 편합니다

**이 가이드를 따라하면 진짜 완성된 시스템이 됩니다!** 🚀✨
