Write-Host "=== HCM System Diagnosis Start ===" -ForegroundColor Green

Write-Host "`n1. Container Status Check" -ForegroundColor Yellow
docker compose ps

Write-Host "`n2. Network Check" -ForegroundColor Yellow
docker network ls | Select-String "hcm"

Write-Host "`n3. Individual Service Health Check" -ForegroundColor Yellow
Write-Host "HR Resource:" -ForegroundColor Cyan
try {
    $result = docker compose exec hr-resource curl -f http://localhost:3001/health 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "OK" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }
} catch { Write-Host "ERROR" -ForegroundColor Red }

Write-Host "Matching Engine:" -ForegroundColor Cyan
try {
    $result = docker compose exec matching-engine curl -f http://localhost:3002/health 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "OK" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }
} catch { Write-Host "ERROR" -ForegroundColor Red }

Write-Host "API Gateway:" -ForegroundColor Cyan
try {
    $result = docker compose exec api-gateway curl -f http://localhost:3000/health 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "OK" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }
} catch { Write-Host "ERROR" -ForegroundColor Red }

Write-Host "`n4. Inter-container Network Test" -ForegroundColor Yellow
Write-Host "API Gateway -> HR Resource:" -ForegroundColor Cyan
try {
    docker compose exec api-gateway ping -c 2 hr-resource 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "PING OK" -ForegroundColor Green } else { Write-Host "PING FAILED" -ForegroundColor Red }
} catch { Write-Host "PING ERROR" -ForegroundColor Red }

Write-Host "API Gateway -> Matching Engine:" -ForegroundColor Cyan
try {
    docker compose exec api-gateway ping -c 2 matching-engine 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "PING OK" -ForegroundColor Green } else { Write-Host "PING FAILED" -ForegroundColor Red }
} catch { Write-Host "PING ERROR" -ForegroundColor Red }

Write-Host "`n5. HTTP Connection Test" -ForegroundColor Yellow
Write-Host "API Gateway -> HR Resource HTTP:" -ForegroundColor Cyan
try {
    docker compose exec api-gateway curl -f http://hr-resource:3001/health 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "HTTP OK" -ForegroundColor Green } else { Write-Host "HTTP FAILED" -ForegroundColor Red }
} catch { Write-Host "HTTP ERROR" -ForegroundColor Red }

Write-Host "API Gateway -> Matching Engine HTTP:" -ForegroundColor Cyan
try {
    docker compose exec api-gateway curl -f http://matching-engine:3002/health 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "HTTP OK" -ForegroundColor Green } else { Write-Host "HTTP FAILED" -ForegroundColor Red }
} catch { Write-Host "HTTP ERROR" -ForegroundColor Red }

Write-Host "`n6. Recent Logs (Last 10 lines)" -ForegroundColor Yellow
Write-Host "HR Resource Logs:" -ForegroundColor Cyan
docker compose logs --tail=10 hr-resource

Write-Host "`nMatching Engine Logs:" -ForegroundColor Cyan
docker compose logs --tail=10 matching-engine

Write-Host "`nAPI Gateway Logs:" -ForegroundColor Cyan
docker compose logs --tail=10 api-gateway

Write-Host "`n7. External Access Test" -ForegroundColor Yellow
Write-Host "Host -> HR Resource:" -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 5 -UseBasicParsing | Out-Null
    Write-Host "EXTERNAL OK" -ForegroundColor Green
} catch { Write-Host "EXTERNAL FAILED" -ForegroundColor Red }

Write-Host "Host -> Matching Engine:" -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri "http://localhost:3002/health" -TimeoutSec 5 -UseBasicParsing | Out-Null
    Write-Host "EXTERNAL OK" -ForegroundColor Green
} catch { Write-Host "EXTERNAL FAILED" -ForegroundColor Red }

Write-Host "Host -> API Gateway:" -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 5 -UseBasicParsing | Out-Null
    Write-Host "EXTERNAL OK" -ForegroundColor Green
} catch { Write-Host "EXTERNAL FAILED" -ForegroundColor Red }

Write-Host "`n=== Diagnosis Complete ===" -ForegroundColor Green