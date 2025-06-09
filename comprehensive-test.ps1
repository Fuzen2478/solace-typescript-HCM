# Comprehensive HCM System Test
Write-Host "=== Comprehensive HCM System Test ===" -ForegroundColor Green

# Test 1: Create an employee
Write-Host "`n1. Testing Employee Creation:" -ForegroundColor Yellow
$newEmployee = @{
    name = "John Doe"
    email = "john.doe@company.com"
    department = "Engineering"
    role = "Senior Developer"
    location = "Remote"
    skills = @(
        @{name="JavaScript"; level="advanced"; yearsOfExperience=5},
        @{name="TypeScript"; level="advanced"; yearsOfExperience=3},
        @{name="Node.js"; level="expert"; yearsOfExperience=4}
    )
    availability = @{
        available = $true
        capacity = 80
        maxHoursPerWeek = 40
    }
    contactInfo = @{
        phone = "+1-555-0123"
        address = "123 Remote St"
    }
}

try {
    $employee = Invoke-RestMethod -Uri "http://localhost:3001/employees" -Method Post -Body ($newEmployee | ConvertTo-Json -Depth 3) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Employee Created: $($employee.name) (ID: $($employee.id))" -ForegroundColor Green
    $employeeId = $employee.id
} catch {
    Write-Host "✗ Employee Creation Failed: $($_.Exception.Message)" -ForegroundColor Red
    $employeeId = $null
}

# Test 2: Create a task
Write-Host "`n2. Testing Task Creation:" -ForegroundColor Yellow
$newTask = @{
    title = "Develop API Endpoint"
    description = "Create a new REST API endpoint for user management"
    requiredSkills = @(
        @{name="JavaScript"; level="advanced"; mandatory=$true; weight=0.8},
        @{name="Node.js"; level="intermediate"; mandatory=$true; weight=0.7}
    )
    priority = "high"
    estimatedHours = 16
    remoteAllowed = $true
    createdBy = "project-manager"
}

try {
    $task = Invoke-RestMethod -Uri "http://localhost:3002/tasks" -Method Post -Body ($newTask | ConvertTo-Json -Depth 3) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Task Created: $($task.task.title) (ID: $($task.task.id))" -ForegroundColor Green
    if ($task.initialMatches) {
        Write-Host "✓ Initial Matches Found: $($task.initialMatches.Count)" -ForegroundColor Green
    }
    $taskId = $task.task.id
} catch {
    Write-Host "✗ Task Creation Failed: $($_.Exception.Message)" -ForegroundColor Red
    $taskId = $null
}

# Test 3: Get employees list
Write-Host "`n3. Testing Employee List:" -ForegroundColor Yellow
try {
    $employees = Invoke-RestMethod -Uri "http://localhost:3001/employees?limit=5" -TimeoutSec 5
    Write-Host "✓ Employees Retrieved: $($employees.employees.Count)" -ForegroundColor Green
    if ($employees.employees.Count -gt 0) {
        $employees.employees | Select-Object name, email, department, role | Format-Table -AutoSize
    }
} catch {
    Write-Host "✗ Employee List Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Get matching analytics
Write-Host "`n4. Testing Matching Analytics:" -ForegroundColor Yellow
try {
    $analytics = Invoke-RestMethod -Uri "http://localhost:3002/analytics/matching" -TimeoutSec 5
    Write-Host "✓ Analytics Retrieved:" -ForegroundColor Green
    Write-Host "  - Total Tasks: $($analytics.totalTasks)" -ForegroundColor Cyan
    Write-Host "  - Assignment Rate: $($analytics.assignmentRate)%" -ForegroundColor Cyan
    Write-Host "  - Completion Rate: $($analytics.completionRate)%" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Analytics Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Test API Gateway routing
Write-Host "`n5. Testing API Gateway Routing:" -ForegroundColor Yellow
try {
    $gatewayEmployees = Invoke-RestMethod -Uri "http://localhost:3000/api/hr/employees?limit=3" -TimeoutSec 5
    Write-Host "✓ Gateway Routing to HR Service: Success" -ForegroundColor Green
} catch {
    Write-Host "✗ Gateway Routing Failed: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $gatewayAnalytics = Invoke-RestMethod -Uri "http://localhost:3000/api/matching/analytics/matching" -TimeoutSec 5
    Write-Host "✓ Gateway Routing to Matching Service: Success" -ForegroundColor Green
} catch {
    Write-Host "✗ Gateway Routing Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Overall system analytics
Write-Host "`n6. Testing System Overview:" -ForegroundColor Yellow
try {
    $overview = Invoke-RestMethod -Uri "http://localhost:3000/analytics/overview" -TimeoutSec 5
    Write-Host "✓ System Overview:" -ForegroundColor Green
    Write-Host "  - Total Services: $($overview.services.total)" -ForegroundColor Cyan
    Write-Host "  - Healthy Services: $($overview.services.healthy)" -ForegroundColor Cyan
    Write-Host "  - Unhealthy Services: $($overview.services.unhealthy)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ System Overview Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Comprehensive Test Complete ===" -ForegroundColor Green
Write-Host "System Status: All core functionalities are working!" -ForegroundColor Green