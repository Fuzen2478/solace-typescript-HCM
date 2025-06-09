# 임시 파일 정리 스크립트
Write-Host "🗑️ 임시 파일들 정리 중..." -ForegroundColor Red

# 임시 JSON 파일들 삭제
if (Test-Path "detail.json") { Remove-Item "detail.json" -Force; Write-Host "  삭제: detail.json" }
if (Test-Path "gateway.json") { Remove-Item "gateway.json" -Force; Write-Host "  삭제: gateway.json" }

# 시스템 파일들 삭제
if (Test-Path ".DS_Store") { Remove-Item ".DS_Store" -Force; Write-Host "  삭제: .DS_Store" }

# 백업 파일들 삭제
if (Test-Path "docker-compose.yml.backup") { Remove-Item "docker-compose.yml.backup" -Force; Write-Host "  삭제: docker-compose.yml.backup" }

Write-Host "✅ 임시 파일 정리 완료!" -ForegroundColor Green
