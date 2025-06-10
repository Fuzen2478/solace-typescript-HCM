@echo off
setlocal enabledelayedexpansion

:: HCM 프로젝트 전체 테스트 스위트 실행 스크립트 (Windows)

:: 테스트 결과 저장 변수
set UNIT_TEST_RESULT=0
set INTEGRATION_TEST_RESULT=0
set SCENARIO_TEST_RESULT=0
set PERFORMANCE_TEST_RESULT=0
set OVERALL_RESULT=0

:: 시작 시간 기록
for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
   set /a "start=(((%%a*60)+1%%b %% 100)*60+1%%c %% 100)*100+1%%d %% 100"
)

echo ========================================================================
echo 🚀 HCM 프로젝트 종합 테스트 스위트 실행
echo ========================================================================
echo ⏰ 시작 시간: %date% %time%
echo 📁 프로젝트 경로: %cd%
echo ========================================================================

:: 1. 환경 확인
echo.
echo [STEP] 1. 테스트 환경 확인
echo ----------------------------------------

:: Node.js 버전 확인
node --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('node --version') do echo [INFO] Node.js 버전: %%i
) else (
    echo [ERROR] Node.js가 설치되지 않았습니다.
    exit /b 1
)

:: npm 버전 확인
npm --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do echo [INFO] npm 버전: %%i
) else (
    echo [ERROR] npm이 설치되지 않았습니다.
    exit /b 1
)

:: Docker 상태 확인
docker --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('docker --version') do echo [INFO] Docker 버전: %%i
    
    docker-compose ps >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] Docker Compose 서비스 상태:
        docker-compose ps
    ) else (
        echo [WARNING] Docker Compose 서비스가 실행되지 않고 있습니다.
    )
) else (
    echo [WARNING] Docker가 설치되지 않았습니다. 일부 테스트가 제한될 수 있습니다.
)

:: 의존성 확인
echo [INFO] 패키지 의존성 확인 중...
npm list --depth=0 --silent >nul 2>&1
if !errorlevel! neq 0 (
    echo [WARNING] 일부 의존성 패키지에 문제가 있을 수 있습니다.
)

:: 2. 단위 테스트 실행
echo.
echo [STEP] 2. 단위 테스트 (Unit Tests) 실행
echo ----------------------------------------

call npm run test:unit
if !errorlevel! equ 0 (
    echo [SUCCESS] 단위 테스트 통과
    set UNIT_TEST_RESULT=0
) else (
    echo [ERROR] 단위 테스트 실패
    set UNIT_TEST_RESULT=1
    set OVERALL_RESULT=1
)

:: 3. 통합 테스트 실행
echo.
echo [STEP] 3. 통합 테스트 (Integration Tests) 실행
echo ----------------------------------------

call npm run test:integration
if !errorlevel! equ 0 (
    echo [SUCCESS] 통합 테스트 통과
    set INTEGRATION_TEST_RESULT=0
) else (
    echo [ERROR] 통합 테스트 실패
    set INTEGRATION_TEST_RESULT=1
    set OVERALL_RESULT=1
)

:: 4. 시나리오 테스트 실행
echo.
echo [STEP] 4. 시나리오 테스트 (Scenario Tests) 실행
echo ----------------------------------------

call npm run test:scenarios
if !errorlevel! equ 0 (
    echo [SUCCESS] 시나리오 테스트 통과
    set SCENARIO_TEST_RESULT=0
) else (
    echo [ERROR] 시나리오 테스트 실패
    set SCENARIO_TEST_RESULT=1
    set OVERALL_RESULT=1
)

:: 5. 성능 테스트 실행
echo.
echo [STEP] 5. 성능 테스트 (Performance Tests) 실행
echo ----------------------------------------

call npm run test:performance
if !errorlevel! equ 0 (
    echo [SUCCESS] 성능 테스트 통과
    set PERFORMANCE_TEST_RESULT=0
) else (
    echo [ERROR] 성능 테스트 실패
    set PERFORMANCE_TEST_RESULT=1
    set OVERALL_RESULT=1
)

:: 6. 테스트 커버리지 리포트 생성 (선택사항)
if "%1"=="--coverage" (
    echo.
    echo [STEP] 6. 테스트 커버리지 리포트 생성
    echo ----------------------------------------
    
    call npm run test:coverage
    if !errorlevel! equ 0 (
        echo [SUCCESS] 커버리지 리포트 생성 완료
        echo [INFO] 커버리지 리포트: coverage\index.html
    ) else (
        echo [WARNING] 커버리지 리포트 생성 실패
    )
)

:: 7. 최종 결과 요약
for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
   set /a "end=(((%%a*60)+1%%b %% 100)*60+1%%c %% 100)*100+1%%d %% 100"
)
set /a elapsed=end-start
if !elapsed! lss 0 set /a elapsed=24*60*60*100+elapsed

echo.
echo ========================================================================
echo 📊 HCM 프로젝트 테스트 결과 요약
echo ========================================================================
echo ⏰ 완료 시간: %date% %time%
echo 🕐 총 소요 시간: !elapsed! centiseconds
echo.

:: 테스트별 결과 표시
echo 📋 테스트별 결과:
if !UNIT_TEST_RESULT! equ 0 (
    echo   ✅ 단위 테스트: 통과
) else (
    echo   ❌ 단위 테스트: 실패
)

if !INTEGRATION_TEST_RESULT! equ 0 (
    echo   ✅ 통합 테스트: 통과
) else (
    echo   ❌ 통합 테스트: 실패
)

if !SCENARIO_TEST_RESULT! equ 0 (
    echo   ✅ 시나리오 테스트: 통과
) else (
    echo   ❌ 시나리오 테스트: 실패
)

if !PERFORMANCE_TEST_RESULT! equ 0 (
    echo   ✅ 성능 테스트: 통과
) else (
    echo   ❌ 성능 테스트: 실패
)

echo.

:: 전체 결과 및 권장사항
if !OVERALL_RESULT! equ 0 (
    echo [SUCCESS] 🎉 모든 테스트가 성공적으로 통과했습니다!
    echo.
    echo 💡 다음 단계:
    echo   - 프로덕션 배포 준비가 완료되었습니다
    echo   - 사용자 수용 테스트(UAT) 진행을 고려해보세요
    echo   - 모니터링 시스템을 설정하여 운영 중 성능을 추적하세요
) else (
    echo [ERROR] ❌ 일부 테스트가 실패했습니다.
    echo.
    echo 🔧 권장 조치사항:
    
    if !UNIT_TEST_RESULT! neq 0 (
        echo   - 단위 테스트 실패: 개별 함수/메서드의 로직을 점검하세요
    )
    
    if !INTEGRATION_TEST_RESULT! neq 0 (
        echo   - 통합 테스트 실패: 서비스 간 통신 및 API 연동을 확인하세요
    )
    
    if !SCENARIO_TEST_RESULT! neq 0 (
        echo   - 시나리오 테스트 실패: 비즈니스 워크플로우를 재검토하세요
    )
    
    if !PERFORMANCE_TEST_RESULT! neq 0 (
        echo   - 성능 테스트 실패: 시스템 리소스 및 성능 최적화가 필요합니다
    )
    
    echo.
    echo 📝 추가 정보:
    echo   - 각 테스트의 상세 로그를 확인하여 구체적인 오류 원인을 파악하세요
    echo   - logs\ 디렉토리에서 시스템 로그를 확인할 수 있습니다
    echo   - npm run test:watch 를 사용하여 개발 중 실시간 테스트를 진행하세요
)

echo.
echo 🔗 유용한 명령어:
echo   - npm run test:unit       : 단위 테스트만 실행
echo   - npm run test:integration : 통합 테스트만 실행
echo   - npm run test:scenarios  : 시나리오 테스트만 실행
echo   - npm run test:performance : 성능 테스트만 실행
echo   - npm run test:coverage   : 코드 커버리지 포함 테스트
echo   - npm run test:watch      : 변경사항 감지 시 자동 테스트

echo ========================================================================

:: 스크립트 종료 코드 반환
exit /b !OVERALL_RESULT!
