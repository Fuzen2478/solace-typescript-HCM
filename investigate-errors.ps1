# Specific Error Investigation
Write-Host "=== Investigating Specific Errors ===" -ForegroundColor Red

Write-Host "`n1. Check latest matching engine errors:" -ForegroundColor Yellow
docker compose logs --tail=10 matching-engine | Select-String -Pattern "error|Error|ERROR"

Write-Host "`n2. Check latest HR resource errors:" -ForegroundColor Yellow
docker compose logs --tail=10 hr-resource | Select-String -Pattern "error|Error|ERROR"

Write-Host "`n3. Test simple task creation first:" -ForegroundColor Yellow
$simpleTaskTest = @{
    title = "Simple Task"
    estimatedHours = 5
}

try {
    $simpleResult = Invoke-RestMethod -Uri "http://localhost:3002/tasks" -Method Post -Body ($simpleTaskTest | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Simple task works: $($simpleResult.task.title)" -ForegroundColor Green
} catch {
    Write-Host "✗ Simple task failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n4. Test analytics endpoint directly:" -ForegroundColor Yellow
try {
    $analyticsTest = Invoke-WebRequest -Uri "http://localhost:3001/analytics/skills" -TimeoutSec 5
    Write-Host "✓ Analytics endpoint status: $($analyticsTest.StatusCode)" -ForegroundColor Green
    Write-Host "Response preview: $($analyticsTest.Content.Substring(0, [Math]::Min(200, $analyticsTest.Content.Length)))" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Analytics failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error body: $errorBody" -ForegroundColor Red
    }
}

Write-Host "`n5. Test minimal complex task (step by step):" -ForegroundColor Yellow
$minimalComplexTask = @{
    title = "Test Complex Task"
    description = "Test"
    requiredSkills = @()
    priority = "medium"
    estimatedHours = 8
    createdBy = "test"
}

try {
    $complexResult = Invoke-RestMethod -Uri "http://localhost:3002/tasks" -Method Post -Body ($minimalComplexTask | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Minimal complex task works: $($complexResult.task.title)" -ForegroundColor Green
} catch {
    Write-Host "✗ Minimal complex task failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Investigation Complete ===" -ForegroundColor Yellow