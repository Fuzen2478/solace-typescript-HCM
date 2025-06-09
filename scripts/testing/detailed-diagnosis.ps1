# Detailed Error Diagnosis
Write-Host "=== Detailed Error Diagnosis ===" -ForegroundColor Red

Write-Host "`n1. HR Resource Detailed Logs:" -ForegroundColor Yellow
docker compose logs --tail=50 hr-resource

Write-Host "`n2. Matching Engine Detailed Logs:" -ForegroundColor Yellow
docker compose logs --tail=50 matching-engine

Write-Host "`n3. API Gateway Detailed Logs:" -ForegroundColor Yellow
docker compose logs --tail=50 api-gateway

Write-Host "`n4. Testing Individual Endpoints:" -ForegroundColor Yellow

# Test HR Resource health endpoint specifically
Write-Host "HR Resource Health Check:" -ForegroundColor Cyan
try {
    $hrHealth = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 5
    Write-Host "✓ HR Health OK: $($hrHealth.status)" -ForegroundColor Green
    $hrHealth | ConvertTo-Json -Depth 3
} catch {
    Write-Host "✗ HR Health Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Matching Engine health endpoint specifically
Write-Host "`nMatching Engine Health Check:" -ForegroundColor Cyan
try {
    $matchingHealth = Invoke-RestMethod -Uri "http://localhost:3002/health" -TimeoutSec 5
    Write-Host "✓ Matching Health OK: $($matchingHealth.status)" -ForegroundColor Green
    $matchingHealth | ConvertTo-Json -Depth 3
} catch {
    Write-Host "✗ Matching Health Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test API Gateway health endpoint specifically
Write-Host "`nAPI Gateway Health Check:" -ForegroundColor Cyan
try {
    $gatewayHealth = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5
    Write-Host "✓ Gateway Health OK: $($gatewayHealth.status)" -ForegroundColor Green
    $gatewayHealth | ConvertTo-Json -Depth 3
} catch {
    Write-Host "✗ Gateway Health Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n5. Test Simple Employee GET (should be empty but not error):" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/employees" -TimeoutSec 5
    Write-Host "✓ Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response Body:" -ForegroundColor Cyan
    $response.Content
} catch {
    Write-Host "✗ Failed with status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error body: $errorBody" -ForegroundColor Red
    }
}

Write-Host "`n=== Diagnosis Complete ===" -ForegroundColor Yellow