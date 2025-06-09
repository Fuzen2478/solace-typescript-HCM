# 🔍 HCM 시스템 실제 실행 검증 TODO 리스트

## 📋 **Phase 1: 환경 설정 및 기본 검증 (30분)**

### ✅ **1.1 의존성 설치 및 확인**
- [ ] `npm install` 실행하여 모든 패키지 설치
- [ ] 누락된 패키지 확인 및 설치
  ```bash
  npm install bcrypt @types/bcrypt
  ```
- [ ] TypeScript 컴파일 오류 확인
  ```bash
  npm run build
  ```

### ✅ **1.2 환경 변수 설정**
- [ ] `.env` 파일 존재 확인
- [ ] 필수 환경 변수 설정 확인:
  ```bash
  # Neo4j
  NEO4J_URI=bolt://localhost:7687
  NEO4J_USER=neo4j
  NEO4J_PASSWORD=password
  
  # Redis
  REDIS_HOST=localhost
  REDIS_PORT=6379
  
  # Service Ports
  HR_SERVICE_PORT=3001
  MATCHING_ENGINE_PORT=3002
  MATCHING_WS_PORT=3003
  VERIFICATION_SERVICE_PORT=3003
  EDGE_AGENT_PORT=3004
  EDGE_WS_PORT=3005
  
  # Security
  VERIFICATION_SECRET=your-secret-key
  ```

### ✅ **1.3 Docker 인프라 시작**
- [ ] Docker Desktop 실행 확인
- [ ] 인프라 서비스 시작
  ```bash
  npm run infra:start
  ```
- [ ] 컨테이너 상태 확인
  ```bash
  docker ps
  ```
- [ ] 예상 컨테이너: `hcm-redis`, `hcm-neo4j`, `hcm-postgres`, `hcm-portainer`

## 📋 **Phase 2: 개별 서비스 실행 테스트 (45분)**

### ✅ **2.1 HR Resource Service 실행 (3001)**
- [ ] 서비스 실행
  ```bash
  npm run dev:hr
  ```
- [ ] 헬스체크 확인
  ```bash
  curl http://localhost:3001/health
  ```
- [ ] 예상 응답: `{"status": "healthy"}`
- [ ] 로그에서 오류 없는지 확인
- [ ] Neo4j 연결 확인

### ✅ **2.2 Matching Engine 실행 (3002)**
- [ ] 서비스 실행 (새 터미널)
  ```bash
  npm run dev:matching
  ```
- [ ] 헬스체크 확인
  ```bash
  curl http://localhost:3002/health
  ```
- [ ] WebSocket 서버 시작 확인 (포트 3003)
- [ ] Redis 연결 확인
- [ ] Neo4j 연결 확인

### ✅ **2.3 Verification Service 실행 (3003)**
- [ ] 포트 충돌 확인 (Matching WS와 동일한 3003 포트)
- [ ] 포트 변경 필요시 수정
  ```typescript
  // verification/index.ts에서 포트 변경
  const PORT = process.env.VERIFICATION_SERVICE_PORT || 3005;
  ```
- [ ] 서비스 실행
  ```bash
  npm run dev:verification
  ```
- [ ] 헬스체크 확인
  ```bash
  curl http://localhost:3005/health  # 포트 수정된 경우
  ```

### ✅ **2.4 Edge Agent 실행 (3004)**
- [ ] 서비스 실행
  ```bash
  npm run dev:edge
  ```
- [ ] 헬스체크 확인
  ```bash
  curl http://localhost:3004/health
  ```
- [ ] WebSocket 서버 시작 확인 (포트 3005)
- [ ] Redis 클러스터 등록 확인

### ✅ **2.5 API Gateway 실행 (3000)**
- [ ] 서비스 실행
  ```bash
  npm run dev:gateway
  ```
- [ ] 헬스체크 확인
  ```bash
  curl http://localhost:3000/health
  ```
- [ ] 서비스 레지스트리 확인
  ```bash
  curl http://localhost:3000/services
  ```

## 📋 **Phase 3: 기본 API 테스트 (30분)**

### ✅ **3.1 직원 생성 테스트**
- [ ] HR Service에 직원 생성
  ```bash
  curl -X POST http://localhost:3001/employees \
    -H "Content-Type: application/json" \
    -d '{
      "name": "John Doe",
      "email": "john.doe@test.com",
      "department": "Engineering",
      "skills": [{"name": "JavaScript", "level": "advanced", "yearsOfExperience": 5}],
      "availability": {"available": true, "capacity": 80, "scheduledHours": 32, "maxHoursPerWeek": 40},
      "location": "Seoul",
      "role": "Developer",
      "workload": 0,
      "maxHoursPerWeek": 40,
      "timezone": "Asia/Seoul",
      "performanceRating": 4,
      "completionRate": 90
    }'
  ```
- [ ] 응답에서 직원 ID 확인
- [ ] Neo4j에 데이터 저장 확인

### ✅ **3.2 작업 생성 및 매칭 테스트**
- [ ] 작업 생성
  ```bash
  curl -X POST http://localhost:3002/tasks \
    -H "Content-Type: application/json" \
    -d '{
      "title": "API Development",
      "description": "Build REST API",
      "requiredSkills": [{"name": "JavaScript", "level": "intermediate", "mandatory": true, "weight": 8}],
      "priority": "high",
      "estimatedHours": 16,
      "remoteAllowed": true,
      "createdBy": "test-user"
    }'
  ```
- [ ] 자동 매칭 결과 확인
- [ ] 매칭 점수 및 이유 확인

### ✅ **3.3 인증서 검증 테스트**
- [ ] 인증서 추가 (직원 ID 사용)
  ```bash
  curl -X POST http://localhost:3005/certifications \
    -H "Content-Type: application/json" \
    -d '{
      "employeeId": "[위에서_생성된_직원_ID]",
      "certificationName": "AWS Developer",
      "issuer": "Amazon Web Services",
      "issueDate": "2024-01-15"
    }'
  ```
- [ ] 자동 검증 확인
- [ ] 검증 해시 생성 확인

### ✅ **3.4 Edge Agent 작업 테스트**
- [ ] 헬스체크 작업 제출
  ```bash
  curl -X POST http://localhost:3004/tasks \
    -H "Content-Type: application/json" \
    -d '{
      "type": "health_check",
      "payload": {},
      "priority": 8
    }'
  ```
- [ ] 작업 실행 및 완료 확인

## 📋 **Phase 4: 통합 테스트 (20분)**

### ✅ **4.1 자동 통합 테스트 실행**
- [ ] 통합 테스트 스크립트 실행
  ```bash
  npm run test:integration:manual
  ```
- [ ] 모든 테스트 케이스 통과 확인
- [ ] 실패 케이스 분석 및 수정

### ✅ **4.2 서비스 간 통신 확인**
- [ ] API Gateway를 통한 프록시 테스트
- [ ] WebSocket 연결 테스트
- [ ] Redis 메시징 동작 확인
- [ ] 실시간 업데이트 확인

## 📋 **Phase 5: 문제 해결 및 최적화 (시간에 따라)**

### ✅ **5.1 발견된 오류 수정**
- [ ] 컴파일 오류 수정
- [ ] 런타임 오류 수정
- [ ] 연결 문제 해결
- [ ] 포트 충돌 해결

### ✅ **5.2 성능 및 안정성 확인**
- [ ] 메모리 사용량 확인
- [ ] 응답 시간 측정
- [ ] 동시 요청 처리 확인
- [ ] 오류 로그 정리

### ✅ **5.3 문서 업데이트**
- [ ] 실제 실행 결과 반영
- [ ] 발견된 이슈 및 해결책 문서화
- [ ] 실행 가이드 업데이트

## 🚨 **예상 문제점 및 해결책**

### **문제 1: 포트 충돌**
- Matching Engine WebSocket (3003) vs Verification Service (3003)
- **해결**: Verification Service 포트를 3005로 변경

### **문제 2: bcrypt 의존성 오류**
```bash
npm install bcrypt @types/bcrypt
```

### **문제 3: Neo4j 연결 실패**
- Neo4j 컨테이너 상태 확인
- 비밀번호 설정 확인 (기본값: password)

### **문제 4: Redis 연결 실패**
- Redis 컨테이너 상태 확인
- 포트 6379 접근 가능 여부 확인

### **문제 5: LDAP 서비스 미구현**
- HR Service의 LDAP 부분 임시 비활성화 또는 Mock 처리

## ⏱️ **예상 소요 시간: 2-3시간**

- **Phase 1**: 30분 (환경 설정)
- **Phase 2**: 45분 (개별 서비스 실행)
- **Phase 3**: 30분 (기본 API 테스트)
- **Phase 4**: 20분 (통합 테스트)
- **Phase 5**: 15-60분 (문제 해결)

## 🎯 **성공 기준**

✅ 모든 5개 서비스가 오류 없이 실행  
✅ 모든 헬스체크 API 정상 응답  
✅ 직원 생성 → 작업 매칭 → 인증서 검증 워크플로우 동작  
✅ 통합 테스트 스크립트 90% 이상 성공  
✅ 실시간 WebSocket 통신 동작  

**이 체크리스트를 하나씩 완료하면 진짜 완성입니다!** 🎉
