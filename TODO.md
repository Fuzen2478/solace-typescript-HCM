# 프로젝트

## 1. 개요
본 프로젝트는 Hyperledger Fabric 기반 블록체인 네트워크를 중심으로, Neo4j 그래프 DB, OpenLDAP 디렉터리 서비스, Solace PubSub 메시지 브로커를 통합하여 분산형 마이크로서비스 아키텍처를 구축합니다.

- **Fabric 네트워크**: Org1(= Peer0) + Orderer + CA  
- **Neo4j**: 그래프 기반 데이터 저장소  
- **OpenLDAP**: 사용자 인증·인가 서비스  
- **Solace PubSub**: 이벤트 메시지 브로커  
- **마이크로서비스**: HR-Resource, Verification, Edge-Agent, Matching-Engine  

### 1.1. 주요 기능
1. 사용자 등록·조회·삭제 (LDAP)  
2. 외부 이벤트(Edge-Agent) 기반 자산 생성 (체인코드 호출)  
3. 온체인·그래프 DB 매핑 검증 (Verification)  
4. 사용자 매칭 로직 → 체인코드 호출 ↔ Neo4j 갱신 (Matching-Engine)

---

## 2. 시스템 구성도

[Fabric CA] ⇒ MSP 발급 ⇒ [Orderer] ⇄ [Peer0]
⇄ [Neo4j]
⇄ [OpenLDAP]
⇄ [Solace PubSub]


---

## 3. 설치 및 실행

### 3.1. 사전 요구사항
- Windows 10/11  
- Git Bash  
- Docker Desktop (WSL2 백엔드 활성화)  
- Visual Studio Code (또는 편집기)  
- Hyperledger Fabric 바이너리 v3.1.1 (`C:\fabric\bin`에 압축 해제)

### 3.2. 프로젝트 클론
```bash
cd C:/Users/pp/Projects
git clone <프로젝트 Git 주소> solace-typescript-HCM
cd solace-typescript-HCM/fabric
```

### 3.3. 디렉터리 구조
fabric/
├─ ca/             
├─ config/         
├─ peers/peer0.org1.example.com/msp/  
├─ orderer/msp/                     
├─ graph-db/data/    
├─ openldap/data/    
├─ docker-compose.yaml
├─ genesis.block     
├─ mychannel.tx      
└─ samples/asset-transfer-basic/chaincode-go

### 3.4. MSP 생성하기

## CA 서버 실행

docker-compose up -d ca.org1.example.com

Admin Enroll

docker exec -it ca.org1.example.com bash
mkdir -p /tmp/msp/org1-admin
export FABRIC_CA_CLIENT_HOME=/tmp/msp/org1-admin
export FABRIC_CA_CLIENT_TLS_CERTFILES=/etc/hyperledger/fabric-ca-server-config/ca-cert.pem
export FABRIC_CA_CLIENT_MSPDIR=msp
fabric-ca-client enroll -u http://admin:adminpw@localhost:7054
exit

mkdir -p /c/Users/pp/Projects/solace-typescript-HCM/fabric/msp/org1-admin
docker cp ca.org1.example.com:/tmp/msp/org1-admin/msp/. \
  /c/Users/pp/Projects/solace-typescript-HCM/fabric/msp/org1-admin/

Peer0 Register & Enroll

# (1) Register
docker exec -it ca.org1.example.com bash
export FABRIC_CA_CLIENT_HOME=/tmp/msp/org1-admin
export FABRIC_CA_CLIENT_TLS_CERTFILES=/etc/hyperledger/fabric-ca-server-config/ca-cert.pem
export FABRIC_CA_CLIENT_MSPDIR=msp
fabric-ca-client register \
  --id.name peer0 \
  --id.secret peer0pw \
  --id.type peer \
  -u http://localhost:7054
exit

# (2) Enroll
docker exec -it ca.org1.example.com bash
mkdir -p /tmp/msp/peer0-org1
export FABRIC_CA_CLIENT_HOME=/tmp/msp/peer0-org1
export FABRIC_CA_CLIENT_TLS_CERTFILES=/etc/hyperledger/fabric-ca-server-config/ca-cert.pem
export FABRIC_CA_CLIENT_MSPDIR=msp
fabric-ca-client enroll -u http://peer0:peer0pw@localhost:7054
exit

# (3) 호스트에 Peer0 MSP 복사
mkdir -p /c/Users/pp/Projects/solace-typescript-HCM/fabric/peers/peer0.org1.example.com/msp
docker cp ca.org1.example.com:/tmp/msp/peer0-org1/msp/. \
  /c/Users/pp/Projects/solace-typescript-HCM/fabric/peers/peer0.org1.example.com/msp/

Orderer Register & Enroll

    # (1) Register
    docker exec -it ca.org1.example.com bash
    export FABRIC_CA_CLIENT_HOME=/tmp/msp/org1-admin
    export FABRIC_CA_CLIENT_TLS_CERTFILES=/etc/hyperledger/fabric-ca-server-config/ca-cert.pem
    export FABRIC_CA_CLIENT_MSPDIR=msp
    fabric-ca-client register \
      --id.name orderer \
      --id.secret ordererpw \
      --id.type orderer \
      -u http://localhost:7054
    exit

    # (2) Enroll
    docker exec -it ca.org1.example.com bash
    mkdir -p /tmp/msp/orderer-org1
    export FABRIC_CA_CLIENT_HOME=/tmp/msp/orderer-org1
    export FABRIC_CA_CLIENT_TLS_CERTFILES=/etc/hyperledger/fabric-ca-server-config/ca-cert.pem
    export FABRIC_CA_CLIENT_MSPDIR=msp
    fabric-ca-client enroll -u http://orderer:ordererpw@localhost:7054
    exit

    # (3) 호스트에 Orderer MSP 복사
    mkdir -p /c/Users/pp/Projects/solace-typescript-HCM/fabric/orderer/msp
    docker cp ca.org1.example.com:/tmp/msp/orderer-org1/msp/. \
      /c/Users/pp/Projects/solace-typescript-HCM/fabric/orderer/msp/

### 3.5. 채널 설정 및 블록 생성

    configtx.yaml 작성
    C:/Users/pp/Projects/solace-typescript-HCM/fabric/config/configtx.yaml에 아래 예시를 붙여넣고, UTF-8+LF 형태로 저장하세요. (들여쓰기는 스페이스만 사용)

CRLF → LF, 탭 제거
Git Bash에서:

cd /c/Users/pp/Projects/solace-typescript-HCM/fabric/config
dos2unix configtx.yaml
sed -i 's/\\t/  /g' configtx.yaml

    cat -n configtx.yaml로 확인하여, Capabilities와 Policies 블록이 올바르게 보이고, ^I(탭)나 ^M(CR)이 없어야 합니다.

컨테이너 안에서 configtxgen 실행
아래 명령을 그대로 복사하여 실행하세요.

docker run --rm \\
  -v "/c/Users/pp/Projects/solace-typescript-HCM/fabric/config:/etc/hyperledger/configtx" \\
  -v "/c/Users/pp/Projects/solace-typescript-HCM/fabric:/etc/hyperledger/fabric" \\
  bitnami/hyperledger-fabric-tools:latest \\
  /bin/bash -c "\\
    export FABRIC_CFG_PATH=/etc/hyperledger/configtx && \\
    configtxgen \\
      -profile OneOrgOrdererGenesis \\
      -outputBlock /etc/hyperledger/fabric/genesis.block \\
      -channelID system-channel && \\
    configtxgen \\
      -profile OneOrgChannel \\
      -outputCreateChannelTx /etc/hyperledger/fabric/mychannel.tx \\
      -channelID mychannel \\
  "

    성공 시, 호스트에 아래 두 파일이 생성됩니다:

        C:\Users\pp\Projects\solace-typescript-HCM\fabric\genesis.block
        C:\Users\pp\Projects\solace-typescript-HCM\fabric\mychannel.tx

### 3.6. 전체 스택 기동 및 채널 조인

    전체 컨테이너 실행

cd /c/Users/pp/Projects/solace-typescript-HCM/fabric
docker-compose up -d

    Fabric CA, Orderer, Peer0, Neo4j, OpenLDAP, Solace PubSub 컨테이너가 모두 올라갑니다.

Peer0로 채널 생성·조인
Git Bash에서:

    export CORE_PEER_TLS_ENABLED=false
    export CORE_PEER_LOCALMSPID="Org1MSP"
    export CORE_PEER_MSPCONFIGPATH="/c/Users/pp/Projects/solace-typescript-HCM/fabric/peers/peer0.org1.example.com/msp"
    export CORE_PEER_ADDRESS=localhost:7051

    # 채널 생성 (mychannel.block 생성)
    peer channel create \\
      -o localhost:7050 \\
      -c mychannel \\
      -f /c/Users/pp/Projects/solace-typescript-HCM/fabric/mychannel.tx

    # 채널 조인
    peer channel join -b /c/Users/pp/Projects/solace-typescript-HCM/fabric/mychannel.block

    # 채널 리스트 확인
    peer channel list

        “mychannel”이 출력되면 정상 생성·조인 완료입니다.

### 3.7. 체인코드 배포 및 테스트

    체인코드 패키지 생성

export CORE_PEER_TLS_ENABLED=false
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_MSPCONFIGPATH="/c/Users/pp/Projects/solace-typescript-HCM/fabric/peers/peer0.org1.example.com/msp"
export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode package basic.tar.gz \\
  --path /c/Users/pp/Projects/solace-typescript-HCM/fabric/samples/asset-transfer-basic/chaincode-go \\
  --lang golang \\
  --label basic_1

체인코드 설치

peer lifecycle chaincode install basic.tar.gz

설치된 패키지 ID 조회

peer lifecycle chaincode queryinstalled
# → Package ID: basic_1:<패키지_ID>

조직 승인(ApproveForMyOrg)

peer lifecycle chaincode approveformyorg \\
  --channelID mychannel \\
  --name basic \\
  --version 1.0 \\
  --package-id basic_1:<패키지_ID> \\
  --sequence 1 \\
  --orderer localhost:7050

체인코드 커밋

peer lifecycle chaincode commit \\
  --channelID mychannel \\
  --name basic \\
  --version 1.0 \\
  --sequence 1 \\
  --peerAddresses localhost:7051 \\
  --orderer localhost:7050

기능 테스트(쿼리)

    peer chaincode query -C mychannel -n basic -c '{"Args":["GetAllAssets"]}'
    # → [] (빈 배열) 또는 초기 자산 목록

### 3.8. 외부 서비스 확인

    Neo4j

        브라우저에서 http://localhost:7474 접속

        로그인: neo4j / neo4jpassword

        쿼리:

    MATCH (n) RETURN n;

OpenLDAP

    ldapsearch -H ldap://localhost:389 \\
      -D "cn=admin,dc=example,dc=com" \\
      -w adminpassword \\
      -b "dc=example,dc=com" "(objectClass=*)"

    Solace PubSub

        브라우저에서 http://localhost:8081 접속

        로그인: admin / admin

### 4. 구현해야 할 주요 기능
### 4.1. HR-Resource (LDAP 사용자 관리)

    언어/프레임워크: Node.js + Express + ldapjs

    기능:

        LDAP 연결 설정 (예: ldap://localhost:389, cn=admin,dc=example,dc=com / adminpassword)

        사용자 CRUD API:

            POST /users → client.add()

            GET /users/:uid → client.search()

            PUT /users/:uid → client.modify()

            DELETE /users/:uid → client.del()

        그룹/역할 관리 (ou=groups 아래 그룹 생성, 멤버 추가/삭제)

### 4.2. Edge-Agent (Solace → Fabric 트랜잭션)

    언어/프레임워크: Node.js

        Solace Node.js 클라이언트(@solace-community/solclientjs)

        Fabric Node SDK (fabric-network)

    기능:

        Solace 브로커 구독(assetCreate 토픽)

        메시지 수신 시 콜백 → Fabric 네트워크 연결

        const { Gateway, Wallets } = require('fabric-network');
        // 연결 프로파일, 지갑(wallet) 로드…
        const contract = network.getContract('basic');
        await contract.submitTransaction(
          'CreateAsset',
          id, color, size, owner, value
        );

        트랜잭션 커밋 확인 후 로그 출력

### 4.3. Verification (온체인 vs Neo4j 검증)

    언어/프레임워크: Node.js

        Fabric SDK (fabric-network)

        Neo4j 드라이버(neo4j-driver)

    API: GET /verify/:assetId

    // Fabric 쿼리
    const result = await contract.evaluateTransaction('ReadAsset', assetId);
    const assetOnChain = JSON.parse(result.toString());

    // Neo4j 쿼리
    const session = driver.session();
    const res = await session.run(
      'MATCH (a:Asset {id: $id}) RETURN a', { id: assetId }
    );
    const assetInGraph = res.records[0].get('a').properties;

    // 비교 결과 반환

### 4.4. Matching-Engine (Neo4j 매칭 + 체인코드)

    언어/프레임워크: Node.js

        Neo4j 드라이버(neo4j-driver)

        Fabric SDK(fabric-network)

    API: POST /match (payload { userA, userB })

        Neo4j Cypher 매칭:

MATCH (u1:User {id: $userA}), (u2:User {id: $userB})
RETURN shortestPath((u1)-[*]-(u2)) AS path;

매칭 조건 만족 시 Fabric 트랜잭션 호출:

await contract.submitTransaction('MatchUsers', userA, userB);

트랜잭션 커밋 후 Neo4j 관계(:MATCHED) 생성:

        MERGE (u1:User {id: $userA})
        MERGE (u2:User {id: $userB})
        MERGE (u1)-[:MATCHED {timestamp: timestamp()}]->(u2);

### 4.5. 공통 사항

    로그 관리: Node.js – winston

    헬스체크: /health 엔드포인트, Docker Compose healthcheck 옵션 사용 가능

    환경 변수 관리: .env 파일에 LDAP, Solace, Fabric connection profile 등 기록

### 5. 확장 및 모니터링 (선택)

    TLS 적용 (Fabric Peer/Orderer/CA)

    다중 조직(Org2, Org3): 멀티채널, 조직별 권한 분리

    모니터링: Prometheus + Grafana – Fabric 메트릭, Neo4j 상태 시각화

    CI/CD: Jenkins/GitHub Actions – 체인코드 자동 빌드·테스트·배포

    High Availability: Neo4j 클러스터 구축, Solace HA 구성

부록: 주요 명령 모음
Fabric 바이너리 설치

mkdir -p /c/fabric/bin
tar -xzf /c/Users/pp/Downloads/hyperledger-fabric-windows-amd64-3.1.1.tar.gz -C /c/fabric
export PATH=$PATH:/c/fabric/bin

CA / MSP

docker-compose up -d ca.org1.example.com

# Admin Enroll
docker exec -it ca.org1.example.com bash
mkdir -p /tmp/msp/org1-admin
export FABRIC_CA_CLIENT_HOME=/tmp/msp/org1-admin
export FABRIC_CA_CLIENT_TLS_CERTFILES=/etc/hyperledger/fabric-ca-server-config/ca-cert.pem
export FABRIC_CA_CLIENT_MSPDIR=msp
fabric-ca-client enroll -u http://admin:adminpw@localhost:7054
exit
mkdir -p /c/Users/pp/Projects/solace-typescript-HCM/fabric/msp/org1-admin
docker cp ca.org1.example.com:/tmp/msp/org1-admin/msp/. \\
     /c/Users/pp/Projects/solace-typescript-HCM/fabric/msp/org1-admin/

# Peer0 Register & Enroll
docker exec -it ca.org1.example.com bash
export FABRIC_CA_CLIENT_HOME=/tmp/msp/org1-admin
export FABRIC_CA_CLIENT_TLS_CERTFILES=/etc/hyperledger/fabric-ca-server-config/ca-cert.pem
export FABRIC_CA_CLIENT_MSPDIR=msp
fabric-ca-client register --id.name peer0 --id.secret peer0pw --id.type peer -u http://localhost:7054
exit

docker exec -it ca.org1.example.com bash
mkdir -p /tmp/msp/peer0-org1
export FABRIC_CA_CLIENT_HOME=/tmp/msp/peer0-org1
export FABRIC_CA_CLIENT_TLS_CERTFILES=/etc/hyperledger/fabric-ca-server-config/ca-cert.pem
export FABRIC_CA_CLIENT_MSPDIR=msp
fabric-ca-client enroll -u http://peer0:peer0pw@localhost:7054
exit

mkdir -p /c/Users/pp/Projects/solace-typescript-HCM/fabric/peers/peer0.org1.example.com/msp
docker cp ca.org1.example.com:/tmp/msp/peer0-org1/msp/. \\
     /c/Users/pp/Projects/solace-typescript-HCM/fabric/peers/peer0.org1.example.com/msp/

# Orderer Register & Enroll
docker exec -it ca.org1.example.com bash
export FABRIC_CA_CLIENT_HOME=/tmp/msp/org1-admin
export FABRIC_CA_CLIENT_TLS_CERTFILES=/etc/hyperledger/fabric-ca-server-config/ca-cert.pem
export FABRIC_CA_CLIENT_MSPDIR=msp
fabric-ca-client register --id.name orderer --id.secret ordererpw --id.type orderer -u http://localhost:7054
exit

docker exec -it ca.org1.example.com bash
mkdir -p /tmp/msp/orderer-org1
export FABRIC_CA_CLIENT_HOME=/tmp/msp/orderer-org1
export FABRIC_CA_CLIENT_TLS_CERTFILES=/etc/hyperledger/fabric-ca-server-config/ca-cert.pem
export FABRIC_CA_CLIENT_MSPDIR=msp
fabric-ca-client enroll -u http://orderer:ordererpw@localhost