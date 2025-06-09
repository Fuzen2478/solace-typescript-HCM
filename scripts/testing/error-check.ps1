# Detailed Error Check
Write-Host "=== Checking Latest Error Logs ===" -ForegroundColor Red

Write-Host "`n1. Latest HR Resource Errors:" -ForegroundColor Yellow
docker compose logs --tail=20 hr-resource | Select-String -Pattern "error|Error|ERROR" | Select-Object -Last 10

Write-Host "`n2. Latest Matching Engine Errors:" -ForegroundColor Yellow  
docker compose logs --tail=20 matching-engine | Select-String -Pattern "error|Error|ERROR" | Select-Object -Last 10

Write-Host "`n3. Test with even simpler data:" -ForegroundColor Yellow

# Test with absolute minimal employee data
$minimalEmployee = @{
    name = "Minimal User"
    email = "minimal@test.com"
    department = "Test"
}

Write-Host "Testing minimal employee creation..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/employees" -Method Post -Body ($minimalEmployee | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Success! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Failed with status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error body: $errorBody" -ForegroundColor Red
    }
}

# Test with minimal task data
$minimalTask = @{
    title = "Minimal Task"
    description = "Test"
    requiredSkills = @()
    priority = "low"
    estimatedHours = 1
    createdBy = "test"
}

Write-Host "`nTesting minimal task creation..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3002/tasks" -Method Post -Body ($minimalTask | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Success! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Failed with status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error body: $errorBody" -ForegroundColor Red
    }
}

Write-Host "`n=== Error Check Complete ===" -ForegroundColor Yellow