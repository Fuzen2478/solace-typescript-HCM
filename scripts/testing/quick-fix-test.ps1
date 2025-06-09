# Quick Fix Test
Write-Host "=== Testing Fixed Services ===" -ForegroundColor Green

# Wait for services to start
Write-Host "Waiting for services to restart..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Test 1: Simple employee creation with minimal data
Write-Host "`n1. Testing Simple Employee Creation:" -ForegroundColor Yellow
$simpleEmployee = @{
    name = "Test User"
    email = "test@example.com"
    department = "Engineering"
    role = "Developer"
    location = "Remote"
    skills = @()
    availability = @{
        available = $true
        capacity = 80
        maxHoursPerWeek = 40
    }
    contactInfo = @{
        phone = "123-456-7890"
        address = "123 Test St"
    }
}

try {
    $employee = Invoke-RestMethod -Uri "http://localhost:3001/employees" -Method Post -Body ($simpleEmployee | ConvertTo-Json -Depth 3) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Employee Created Successfully: $($employee.name)" -ForegroundColor Green
} catch {
    Write-Host "✗ Employee Creation Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error details: $errorBody" -ForegroundColor Red
    }
}

# Test 2: Simple task creation
Write-Host "`n2. Testing Simple Task Creation:" -ForegroundColor Yellow
$simpleTask = @{
    title = "Simple Test Task"
    description = "A test task"
    requiredSkills = @()
    priority = "medium"
    estimatedHours = 8
    remoteAllowed = $true
    createdBy = "test-user"
}

try {
    $task = Invoke-RestMethod -Uri "http://localhost:3002/tasks" -Method Post -Body ($simpleTask | ConvertTo-Json -Depth 3) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Task Created Successfully: $($task.task.title)" -ForegroundColor Green
} catch {
    Write-Host "✗ Task Creation Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error details: $errorBody" -ForegroundColor Red
    }
}

# Test 3: Get employees list
Write-Host "`n3. Testing Employee List:" -ForegroundColor Yellow
try {
    $employees = Invoke-RestMethod -Uri "http://localhost:3001/employees?limit=5" -TimeoutSec 5
    Write-Host "✓ Employee List Retrieved: $($employees.employees.Count) employees" -ForegroundColor Green
} catch {
    Write-Host "✗ Employee List Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Fix Test Complete ===" -ForegroundColor Green