# Final Fix Test - Neo4j Object Serialization
Write-Host "=== Final Fix Test - Neo4j Object Serialization ===" -ForegroundColor Green

# Test 1: Super simple employee (only required fields)
Write-Host "`n1. Testing Super Simple Employee:" -ForegroundColor Yellow
$ultraSimpleEmployee = @{
    name = "John Doe"
    email = "john@test.com"
    department = "IT"
}

try {
    $employee = Invoke-RestMethod -Uri "http://localhost:3001/employees" -Method Post -Body ($ultraSimpleEmployee | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Employee Created Successfully!" -ForegroundColor Green
    Write-Host "  ID: $($employee.id)" -ForegroundColor Cyan
    Write-Host "  Name: $($employee.name)" -ForegroundColor Cyan
    Write-Host "  Email: $($employee.email)" -ForegroundColor Cyan
    Write-Host "  Department: $($employee.department)" -ForegroundColor Cyan
    $employeeId = $employee.id
} catch {
    Write-Host "✗ Employee Creation Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error details: $errorBody" -ForegroundColor Red
    }
    $employeeId = $null
}

# Test 2: Super simple task
Write-Host "`n2. Testing Super Simple Task:" -ForegroundColor Yellow
$ultraSimpleTask = @{
    title = "Test Task"
    estimatedHours = 5
}

try {
    $task = Invoke-RestMethod -Uri "http://localhost:3002/tasks" -Method Post -Body ($ultraSimpleTask | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Task Created Successfully!" -ForegroundColor Green
    Write-Host "  ID: $($task.task.id)" -ForegroundColor Cyan
    Write-Host "  Title: $($task.task.title)" -ForegroundColor Cyan
    Write-Host "  Hours: $($task.task.estimatedHours)" -ForegroundColor Cyan
    if ($task.initialMatches) {
        Write-Host "  Initial Matches: $($task.initialMatches.Count)" -ForegroundColor Cyan
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

# Test 3: Employee with complex data
Write-Host "`n3. Testing Employee with Complex Data:" -ForegroundColor Yellow
$complexEmployee = @{
    name = "Jane Smith"
    email = "jane@test.com"
    department = "Engineering"
    role = "Senior Developer"
    location = "Remote"
    skills = @(
        @{name="JavaScript"; level="advanced"; yearsOfExperience=5},
        @{name="Python"; level="intermediate"; yearsOfExperience=3}
    )
    availability = @{
        available = $true
        capacity = 80
        maxHoursPerWeek = 40
    }
    contactInfo = @{
        phone = "+1-555-0123"
        address = "456 Complex St"
    }
}

try {
    $complexEmp = Invoke-RestMethod -Uri "http://localhost:3001/employees" -Method Post -Body ($complexEmployee | ConvertTo-Json -Depth 5) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Complex Employee Created Successfully!" -ForegroundColor Green
    Write-Host "  ID: $($complexEmp.id)" -ForegroundColor Cyan
    Write-Host "  Name: $($complexEmp.name)" -ForegroundColor Cyan
    Write-Host "  Skills Count: $($complexEmp.skills.Count)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Complex Employee Creation Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error details: $errorBody" -ForegroundColor Red
    }
}

# Test 4: Check employees list
Write-Host "`n4. Testing Employee List:" -ForegroundColor Yellow
try {
    $employees = Invoke-RestMethod -Uri "http://localhost:3001/employees?limit=10" -TimeoutSec 5
    Write-Host "✓ Employee List Retrieved: $($employees.employees.Count) employees" -ForegroundColor Green
    if ($employees.employees.Count -gt 0) {
        Write-Host "Employees:" -ForegroundColor Cyan
        $employees.employees | ForEach-Object {
            Write-Host "  - $($_.name) ($($_.email)) - $($_.department)" -ForegroundColor White
        }
    }
} catch {
    Write-Host "✗ Employee List Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Final Fix Test Complete ===" -ForegroundColor Green
Write-Host "If all tests passed, the Neo4j serialization issue is fixed!" -ForegroundColor Green