#!/bin/bash

# HCM 프로젝트 전체 테스트 스위트 실행 스크립트

set -e  # 오류 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 테스트 결과 저장 변수
UNIT_TEST_RESULT=0
INTEGRATION_TEST_RESULT=0
SCENARIO_TEST_RESULT=0
PERFORMANCE_TEST_RESULT=0
OVERALL_RESULT=0

# 시작 시간 기록
START_TIME=$(date +%s)

echo "========================================================================"
echo "🚀 HCM 프로젝트 종합 테스트 스위트 실행"
echo "========================================================================"
echo "⏰ 시작 시간: $(date)"
echo "📁 프로젝트 경로: $(pwd)"
echo "========================================================================"

# 1. 환경 확인
log_step "1. 테스트 환경 확인"

# Node.js 버전 확인
if command -v node &> /dev/null; then
    log_info "Node.js 버전: $(node --version)"
else
    log_error "Node.js가 설치되지 않았습니다."
    exit 1
fi

# npm 버전 확인  
if command -v npm &> /dev/null; then
    log_info "npm 버전: $(npm --version)"
else
    log_error "npm이 설치되지 않았습니다."
    exit 1
fi

# Docker 상태 확인
if command -v docker &> /dev/null; then
    log_info "Docker 버전: $(docker --version)"
    
    # Docker Compose 상태 확인
    if docker-compose ps &> /dev/null; then
        log_info "Docker Compose 서비스 상태:"
        docker-compose ps --format "table {{.Name}}\t{{.State}}\t{{.Ports}}" | head -10
    else
        log_warning "Docker Compose 서비스가 실행되지 않고 있습니다."
    fi
else
    log_warning "Docker가 설치되지 않았습니다. 일부 테스트가 제한될 수 있습니다."
fi

# 의존성 확인
log_info "패키지 의존성 확인 중..."
npm list --depth=0 --silent || log_warning "일부 의존성 패키지에 문제가 있을 수 있습니다."

echo ""

# 2. 단위 테스트 실행
log_step "2. 단위 테스트 (Unit Tests) 실행"
echo "----------------------------------------"

if npm run test:unit; then
    log_success "단위 테스트 통과"
    UNIT_TEST_RESULT=0
else
    log_error "단위 테스트 실패"
    UNIT_TEST_RESULT=1
    OVERALL_RESULT=1
fi

echo ""

# 3. 통합 테스트 실행
log_step "3. 통합 테스트 (Integration Tests) 실행"
echo "----------------------------------------"

if npm run test:integration; then
    log_success "통합 테스트 통과"
    INTEGRATION_TEST_RESULT=0
else
    log_error "통합 테스트 실패"
    INTEGRATION_TEST_RESULT=1
    OVERALL_RESULT=1
fi

echo ""

# 4. 시나리오 테스트 실행
log_step "4. 시나리오 테스트 (Scenario Tests) 실행"
echo "----------------------------------------"

if npm run test:scenarios; then
    log_success "시나리오 테스트 통과"
    SCENARIO_TEST_RESULT=0
else
    log_error "시나리오 테스트 실패"
    SCENARIO_TEST_RESULT=1
    OVERALL_RESULT=1
fi

echo ""

# 5. 성능 테스트 실행
log_step "5. 성능 테스트 (Performance Tests) 실행"
echo "----------------------------------------"

if npm run test:performance; then
    log_success "성능 테스트 통과"
    PERFORMANCE_TEST_RESULT=0
else
    log_error "성능 테스트 실패"
    PERFORMANCE_TEST_RESULT=1
    OVERALL_RESULT=1
fi

echo ""

# 6. 테스트 커버리지 리포트 생성 (선택사항)
if [ "$1" = "--coverage" ] || [ "$1" = "-c" ]; then
    log_step "6. 테스트 커버리지 리포트 생성"
    echo "----------------------------------------"
    
    if npm run test:coverage; then
        log_success "커버리지 리포트 생성 완료"
        log_info "커버리지 리포트: coverage/index.html"
    else
        log_warning "커버리지 리포트 생성 실패"
    fi
    echo ""
fi

# 7. 최종 결과 요약
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "========================================================================"
echo "📊 HCM 프로젝트 테스트 결과 요약"
echo "========================================================================"
echo "⏰ 완료 시간: $(date)"
echo "🕐 총 소요 시간: ${DURATION}초"
echo ""

# 테스트별 결과 표시
echo "📋 테스트별 결과:"
if [ $UNIT_TEST_RESULT -eq 0 ]; then
    echo "  ✅ 단위 테스트: 통과"
else
    echo "  ❌ 단위 테스트: 실패"
fi

if [ $INTEGRATION_TEST_RESULT -eq 0 ]; then
    echo "  ✅ 통합 테스트: 통과"
else
    echo "  ❌ 통합 테스트: 실패"
fi

if [ $SCENARIO_TEST_RESULT -eq 0 ]; then
    echo "  ✅ 시나리오 테스트: 통과"
else
    echo "  ❌ 시나리오 테스트: 실패"
fi

if [ $PERFORMANCE_TEST_RESULT -eq 0 ]; then
    echo "  ✅ 성능 테스트: 통과"
else
    echo "  ❌ 성능 테스트: 실패"
fi

echo ""

# 전체 결과 및 권장사항
if [ $OVERALL_RESULT -eq 0 ]; then
    log_success "🎉 모든 테스트가 성공적으로 통과했습니다!"
    echo ""
    echo "💡 다음 단계:"
    echo "  - 프로덕션 배포 준비가 완료되었습니다"
    echo "  - 사용자 수용 테스트(UAT) 진행을 고려해보세요"
    echo "  - 모니터링 시스템을 설정하여 운영 중 성능을 추적하세요"
else
    log_error "❌ 일부 테스트가 실패했습니다."
    echo ""
    echo "🔧 권장 조치사항:"
    
    if [ $UNIT_TEST_RESULT -ne 0 ]; then
        echo "  - 단위 테스트 실패: 개별 함수/메서드의 로직을 점검하세요"
    fi
    
    if [ $INTEGRATION_TEST_RESULT -ne 0 ]; then
        echo "  - 통합 테스트 실패: 서비스 간 통신 및 API 연동을 확인하세요"
    fi
    
    if [ $SCENARIO_TEST_RESULT -ne 0 ]; then
        echo "  - 시나리오 테스트 실패: 비즈니스 워크플로우를 재검토하세요"
    fi
    
    if [ $PERFORMANCE_TEST_RESULT -ne 0 ]; then
        echo "  - 성능 테스트 실패: 시스템 리소스 및 성능 최적화가 필요합니다"
    fi
    
    echo ""
    echo "📝 추가 정보:"
    echo "  - 각 테스트의 상세 로그를 확인하여 구체적인 오류 원인을 파악하세요"
    echo "  - logs/ 디렉토리에서 시스템 로그를 확인할 수 있습니다"
    echo "  - npm run test:watch 를 사용하여 개발 중 실시간 테스트를 진행하세요"
fi

echo ""
echo "🔗 유용한 명령어:"
echo "  - npm run test:unit      : 단위 테스트만 실행"
echo "  - npm run test:integration : 통합 테스트만 실행"
echo "  - npm run test:scenarios : 시나리오 테스트만 실행"
echo "  - npm run test:performance : 성능 테스트만 실행"
echo "  - npm run test:coverage  : 코드 커버리지 포함 테스트"
echo "  - npm run test:watch     : 변경사항 감지 시 자동 테스트"

echo "========================================================================"

# 스크립트 종료 코드 반환
exit $OVERALL_RESULT
