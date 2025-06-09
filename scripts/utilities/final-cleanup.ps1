# 최종 정리 스크립트
Write-Host "🧹 최종 정리 작업 실행 중..." -ForegroundColor Green

# 남은 임시 파일들 삭제
$tempFiles = @(".DS_Store", "detail.json", "gateway.json", "docker-compose.yml.backup")
foreach ($file in $tempFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "✅ 삭제: $file" -ForegroundColor Red
    }
}

Write-Host "`n🎯 프로젝트 정리 완료!" -ForegroundColor Green
Write-Host "📊 정리 결과:" -ForegroundColor Cyan
Write-Host "  🗂️ 루트 파일 수: $(Get-ChildItem -File | Measure-Object).Count" -ForegroundColor Yellow
Write-Host "  📁 정리된 스크립트: scripts/ 폴더" -ForegroundColor Blue
Write-Host "  📚 정리된 문서: docs/ 폴더" -ForegroundColor Magenta
Write-Host "  🐳 정리된 설정: configs/ 폴더" -ForegroundColor Cyan
