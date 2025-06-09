# Quick HCM System Check
Write-Host "=== Quick HCM Status Check ===" -ForegroundColor Green

# Container status
Write-Host "`nContainer Status:" -ForegroundColor Yellow
docker compose ps

# Quick health checks
Write-Host "`nHealth Checks:" -ForegroundColor Yellow
$services = @("hr-resource", "matching-engine", "api-gateway")
$ports = @(3001, 3002, 3000)

for ($i = 0; $i -lt $services.Length; $i++) {
    $service = $services[$i]
    $port = $ports[$i]
    
    Write-Host "$service " -NoNewline -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$port/health" -TimeoutSec 3 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "OK" -ForegroundColor Green
        } else {
            Write-Host "FAILED" -ForegroundColor Red
        }
    } catch {
        Write-Host "FAILED" -ForegroundColor Red
    }
}

# Show recent errors if any
Write-Host "`nRecent Errors:" -ForegroundColor Yellow
docker compose logs --tail=5 2>&1 | Select-String -Pattern "error|Error|ERROR|failed|Failed|FAILED" | Select-Object -First 10

Write-Host "`n=== Check Complete ===" -ForegroundColor Green