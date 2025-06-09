# Test HCM Services
Write-Host "=== HCM Services Test ===" -ForegroundColor Green

# Test each service endpoint
$services = @(
    @{name="HR Resource"; url="http://localhost:3001/health"},
    @{name="Matching Engine"; url="http://localhost:3002/health"},
    @{name="API Gateway"; url="http://localhost:3000/health"}
)

foreach ($service in $services) {
    Write-Host "`nTesting $($service.name):" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri $service.url -TimeoutSec 5
        Write-Host "✓ Status: $($response.status)" -ForegroundColor Green
        Write-Host "✓ Timestamp: $($response.timestamp)" -ForegroundColor Green
        if ($response.services) {
            Write-Host "✓ Services:" -ForegroundColor Green
            $response.services | Format-Table -AutoSize
        }
    } catch {
        Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test API Gateway service discovery
Write-Host "`nTesting API Gateway Service Discovery:" -ForegroundColor Yellow
try {
    $services = Invoke-RestMethod -Uri "http://localhost:3000/services" -TimeoutSec 5
    Write-Host "✓ Discovered Services:" -ForegroundColor Green
    $services.services | Format-Table name, status, url -AutoSize
} catch {
    Write-Host "✗ Service Discovery Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test workflow functionality
Write-Host "`nTesting Basic Workflow:" -ForegroundColor Yellow
try {
    $healthMonitoring = Invoke-RestMethod -Uri "http://localhost:3000/workflows/health-monitoring" -TimeoutSec 10
    Write-Host "✓ Health Monitoring Workflow: $($healthMonitoring.status)" -ForegroundColor Green
    if ($healthMonitoring.results.serviceHealth) {
        Write-Host "✓ Service Health Status:" -ForegroundColor Green
        $healthMonitoring.results.serviceHealth | Format-Table name, status -AutoSize
    }
} catch {
    Write-Host "✗ Workflow Test Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Green