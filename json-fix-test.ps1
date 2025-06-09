# Simple JSON Fix Test
Write-Host "=== Testing JSON Parsing Fix ===" -ForegroundColor Green

Write-Host "`n1. Creating a simple employee..." -ForegroundColor Yellow
$simpleEmployee = @{
    name = "Test User"
    email = "test@simple.com"
    department = "Test"
}

try {
    $employee = Invoke-RestMethod -Uri "http://localhost:3001/employees" -Method Post -Body ($simpleEmployee | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Employee Created: $($employee.name)" -ForegroundColor Green
} catch {
    Write-Host "✗ Employee Creation Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n2. Creating a simple task..." -ForegroundColor Yellow
$simpleTask = @{
    title = "Simple Task"
    estimatedHours = 3
}

try {
    $task = Invoke-RestMethod -Uri "http://localhost:3002/tasks" -Method Post -Body ($simpleTask | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Task Created: $($task.task.title)" -ForegroundColor Green
    if ($task.initialMatches -and $task.initialMatches.Count -gt 0) {
        Write-Host "✓ Found $($task.initialMatches.Count) initial matches!" -ForegroundColor Green
    } else {
        Write-Host "ⓘ No initial matches found (expected with simple data)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Task Creation Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Checking employee list..." -ForegroundColor Yellow
try {
    $employees = Invoke-RestMethod -Uri "http://localhost:3001/employees?limit=5" -TimeoutSec 5
    Write-Host "✓ Retrieved $($employees.employees.Count) employees" -ForegroundColor Green
    
    if ($employees.employees.Count -gt 0) {
        $emp = $employees.employees[0]
        Write-Host "First employee data:" -ForegroundColor Cyan
        Write-Host "  Name: $($emp.name)" -ForegroundColor White
        Write-Host "  Email: $($emp.email)" -ForegroundColor White
        Write-Host "  Skills type: $($emp.skills.GetType().Name)" -ForegroundColor White
        Write-Host "  Availability type: $($emp.availability.GetType().Name)" -ForegroundColor White
    }
} catch {
    Write-Host "✗ Employee List Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== JSON Parsing Test Complete ===" -ForegroundColor Green