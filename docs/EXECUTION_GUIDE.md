# HCM 시스템 실행 가이드 (블록체인 제외 버전)

## 🚀 전체 시스템 시작 순서

### 1. Docker 컨테이너 상태 확인
```powershell
docker ps

필요한 컨테이너:

    neo4j

    openldap

    solace-standard


2. Docker Compose로 서비스 기동

cd C:\Users\pp\Projects\solace-typescript-HCM
docker-compose up -d

    Neo4j, OpenLDAP, Solace PubSub Standard 컨테이너가 모두 올라오는지 확인합니다.

3. 마이크로서비스 시작
옵션 1: 모든 서비스 한 번에 시작

cd C:\Users\pp\Projects\solace-typescript-HCM
npm run dev

옵션 2: 각 서비스 개별 시작 (별도 터미널에서)

# Terminal 1 - HR Service
npm run dev:hr

# Terminal 2 - Matching Engine
npm run dev:matching

# Terminal 3 - Verification Service
npm run dev:verification

# Terminal 4 - Edge Agent
npm run dev:edge

    참고: .env 파일이나 설정 파일에서 Fabric 관련 환경 변수(예: CORE_PEER_, ORDERER_ 등)를 모두 제거했는지 확인하세요.

4. 시스템 테스트

.\test-system.ps1

    전체 기능이 잘 동작하는지 자동화 스크립트로 확인합니다.

📊 모니터링
서비스 상태 확인

    HR Service: http://localhost:3001/health

    Matching Engine: http://localhost:3002/health

    Verification Service: http://localhost:3003/health

    Edge Agent: http://localhost:3004/health

로그 확인

# Docker 로그
docker logs neo4j
docker logs openldap
docker logs solace-standard

# 서비스 로그 (각 서비스 실행 디렉터리에서)
Get-Content hr-resource.log -Tail 50
Get-Content matching-engine.log -Tail 50
Get-Content verification.log -Tail 50
Get-Content edge-agent.log -Tail 50

외부 서비스 UI

    Neo4j Browser: http://localhost:7474
    (기본 계정: neo4j / neo4jpassword)

    Solace Admin: http://localhost:8081
    (관리자 계정: admin / admin)

🛑 시스템 종료
1. 마이크로서비스 종료

서비스를 실행 중인 터미널에서 Ctrl+C를 눌러 각 Node.js 프로세스를 중단합니다.
2. Docker 컨테이너 종료

cd C:\Users\pp\Projects\solace-typescript-HCM
docker-compose down

    네트워크, 볼륨 등도 함께 정리하려면:

    docker-compose down -v
    docker system prune -f

🔧 문제 해결
Neo4j 연결 실패

    docker ps 결과에 neo4j 컨테이너가 Up 상태인지 확인

    브라우저에서 http://localhost:7474 접속 시 비밀번호를 neo4jpassword로 입력

OpenLDAP 연결 실패

    docker ps 결과에 openldap 컨테이너가 Up 상태인지 확인

    LDAP 클라이언트(예: Apache Directory Studio)에서

    Host: localhost  
    Port: 389  
    Bind DN: cn=admin,dc=example,dc=com  
    Password: adminpassword

Solace PubSub 연결 실패

    docker ps 결과에 solace-standard 컨테이너가 Up 상태인지 확인

    브라우저에서 http://localhost:8081 접속(관리 콘솔) 시

    Username: admin  
    Password: admin

서비스 실행 오류

    각 Node.js 서비스 디렉터리(hr, matching, verification, edge)에서

    npm install
    npm run build

    후 다시 실행해 봅니다.

    .env 파일의 설정(포트, DB URL, LDAP URL 등)이 올바른지 확인합니다.

📝 주요 API 엔드포인트
HR Service (3001)

    POST /employees
    직원 생성 (요청 바디: { "name": "...", "department": "...", "skills": ["...","..."] })

    GET /employees
    모든 직원 조회

    GET /employees/by-skill/:skill
    해당 스킬을 가진 직원 조회

    PATCH /employees/:id/availability
    직원 가용성 업데이트 (요청 바디: { "available": true/false })

Matching Engine (3002)

    POST /tasks
    작업 생성 (요청 바디: { "title": "...", "requirements": ["...","..."] })

    GET /tasks/:taskId/recommendations
    작업 추천 결과 조회

    POST /tasks/:taskId/assign
    작업 할당 (요청 바디: { "employeeId": "EMP001" })

    GET /stats
    통계 정보 조회

Verification Service (3003)

    POST /certifications
    자격증 추가 (요청 바디: { "employeeId": "EMP001", "certName": "..." })

    POST /work-history
    경력 추가 (요청 바디: { "employeeId": "EMP001", "company": "...", "years": 3 })

    GET /employees/:employeeId/credentials
    직원 자격 정보 조회

    POST /certifications/:certificationId/verify
    자격증 검증 요청

Edge Agent (3004)

    POST /trigger-event
    이벤트 트리거 (요청 바디: { "eventType": "...", "payload": { ... } })

    GET /status
    현재 Edge Agent 상태 조회

    GET /health
    헬스 체크 (200 OK 반환)

