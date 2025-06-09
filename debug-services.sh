#!/bin/bash

echo "=== HCM 시스템 진단 시작 ==="

echo -e "\n1. 컨테이너 상태 확인"
docker compose ps

echo -e "\n2. 네트워크 확인"
docker network ls | grep hcm

echo -e "\n3. 개별 서비스 Health Check"
echo "HR Resource:"
timeout 5 docker compose exec hr-resource curl -f http://localhost:3001/health 2>/dev/null || echo "FAILED"

echo -e "\nMatching Engine:"
timeout 5 docker compose exec matching-engine curl -f http://localhost:3002/health 2>/dev/null || echo "FAILED"

echo -e "\nAPI Gateway:"
timeout 5 docker compose exec api-gateway curl -f http://localhost:3000/health 2>/dev/null || echo "FAILED"

echo -e "\n4. 컨테이너 간 네트워크 테스트"
echo "API Gateway -> HR Resource:"
timeout 5 docker compose exec api-gateway ping -c 2 hr-resource 2>/dev/null || echo "PING FAILED"

echo -e "\nAPI Gateway -> Matching Engine:"
timeout 5 docker compose exec api-gateway ping -c 2 matching-engine 2>/dev/null || echo "PING FAILED"

echo -e "\n5. HTTP 연결 테스트"
echo "API Gateway -> HR Resource HTTP:"
timeout 5 docker compose exec api-gateway curl -f http://hr-resource:3001/health 2>/dev/null || echo "HTTP FAILED"

echo -e "\nAPI Gateway -> Matching Engine HTTP:"
timeout 5 docker compose exec api-gateway curl -f http://matching-engine:3002/health 2>/dev/null || echo "HTTP FAILED"

echo -e "\n6. 최근 로그 (마지막 10줄)"
echo "HR Resource 로그:"
docker compose logs --tail=10 hr-resource | tail -5

echo -e "\nMatching Engine 로그:"
docker compose logs --tail=10 matching-engine | tail -5

echo -e "\nAPI Gateway 로그:"
docker compose logs --tail=10 api-gateway | tail -5

echo -e "\n7. 외부 접근 테스트"
echo "Host -> HR Resource:"
timeout 5 curl -f http://localhost:3001/health 2>/dev/null || echo "EXTERNAL FAILED"

echo -e "\nHost -> Matching Engine:"
timeout 5 curl -f http://localhost:3002/health 2>/dev/null || echo "EXTERNAL FAILED"

echo -e "\nHost -> API Gateway:"
timeout 5 curl -f http://localhost:3000/health 2>/dev/null || echo "EXTERNAL FAILED"

echo -e "\n=== 진단 완료 ==="