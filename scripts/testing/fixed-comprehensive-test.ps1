# Fixed Comprehensive HCM System Test
Write-Host "=== Fixed Comprehensive HCM System Test ===" -ForegroundColor Green

# First run detailed diagnosis
Write-Host "`n=== Running Detailed Diagnosis First ===" -ForegroundColor Yellow
.\detailed-diagnosis.ps1

Write-Host "`n=== Now Testing with Correct Routes ===" -ForegroundColor Yellow

# Test 1: Create an employee (using correct API Gateway route)
Write-Host "`n1. Testing Employee Creation via API Gateway:" -ForegroundColor Yellow
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

# Try direct HR service first
Write-Host "Direct HR Service:" -ForegroundColor Cyan
try {
    $employee = Invoke-RestMethod -Uri "http://localhost:3001/employees" -Method Post -Body ($newEmployee | ConvertTo-Json -Depth 3) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Employee Created: $($employee.name) (ID: $($employee.id))" -ForegroundColor Green
    $employeeId = $employee.id
} catch {
    Write-Host "✗ Direct HR Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error details: $errorBody" -ForegroundColor Red
    }
    $employeeId = $null
}

# Test 2: Create a task (direct to matching engine)
Write-Host "`n2. Testing Task Creation via Direct Service:" -ForegroundColor Yellow
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
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error details: $errorBody" -ForegroundColor Red
    }
    $taskId = $null
}

# Test 3: Get employees list (direct)
Write-Host "`n3. Testing Employee List (Direct):" -ForegroundColor Yellow
try {
    $employees = Invoke-RestMethod -Uri "http://localhost:3001/employees?limit=5" -TimeoutSec 5
    Write-Host "✓ Employees Retrieved: $($employees.employees.Count)" -ForegroundColor Green
    if ($employees.employees.Count -gt 0) {
        $employees.employees | Select-Object name, email, department, role | Format-Table -AutoSize
    }
} catch {
    Write-Host "✗ Employee List Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Test API Gateway workflows (these should work)
Write-Host "`n4. Testing API Gateway Workflows:" -ForegroundColor Yellow
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

# Test 5: Test if API Gateway proxy routes work (they might have different paths)
Write-Host "`n5. Testing API Gateway Service Discovery:" -ForegroundColor Yellow
try {
    $services = Invoke-RestMethod -Uri "http://localhost:3000/services" -TimeoutSec 5
    Write-Host "✓ Service Discovery:" -ForegroundColor Green
    $services.services | Format-Table name, status, url -AutoSize
    
    # Check which services are healthy
    $healthyServices = $services.services | Where-Object { $_.status -eq "healthy" }
    Write-Host "Healthy Services: $($healthyServices.Count)" -ForegroundColor Green
} catch {
    Write-Host "✗ Service Discovery Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Fixed Test Complete ===" -ForegroundColor Green