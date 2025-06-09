# Test HCM System

Write-Host "Testing HCM System..." -ForegroundColor Green

# Base URLs
$hrService = "http://localhost:3001"
$matchingEngine = "http://localhost:3002"
$verificationService = "http://localhost:3003"
$edgeAgent = "http://localhost:3004"

# Test data
$employee1 = @{
    name = "Alice Johnson"
    email = "alice@example.com"
    department = "Engineering"
    skills = @("JavaScript", "TypeScript", "Docker", "Kubernetes")
    availability = $true
    location = "Seoul"
    role = "Senior Developer"
} | ConvertTo-Json

$employee2 = @{
    name = "Bob Smith"
    email = "bob@example.com"
    department = "DevOps"
    skills = @("Docker", "Kubernetes", "AWS", "Terraform")
    availability = $true
    location = "Seoul"
    role = "DevOps Engineer"
} | ConvertTo-Json

$task1 = @{
    title = "Deploy Microservices"
    description = "Deploy new microservices to Kubernetes cluster"
    requiredSkills = @("Docker", "Kubernetes")
    priority = "high"
    estimatedHours = 8
    deadline = (Get-Date).AddDays(3).ToString("yyyy-MM-dd")
    location = "Seoul"
} | ConvertTo-Json

# Function to test API endpoint
function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Body = $null,
        [string]$Description
    )
    
    Write-Host "`n$Description" -ForegroundColor Yellow
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($Method -eq "GET") {
            $response = Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers
        } else {
            $response = Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers -Body $Body
        }
        
        Write-Host "✓ Success" -ForegroundColor Green
        $response | ConvertTo-Json -Depth 10 | Write-Host
        return $response
    } catch {
        Write-Host "✗ Failed: $_" -ForegroundColor Red
        return $null
    }
}

# Check services health
Write-Host "`n=== Checking Service Health ===" -ForegroundColor Cyan
Test-Endpoint -Method "GET" -Url "$hrService/health" -Description "HR Service Health"
Test-Endpoint -Method "GET" -Url "$matchingEngine/health" -Description "Matching Engine Health"
Test-Endpoint -Method "GET" -Url "$verificationService/health" -Description "Verification Service Health"
Test-Endpoint -Method "GET" -Url "$edgeAgent/health" -Description "Edge Agent Health"

# Wait for user confirmation
Write-Host "`nPress Enter to continue with tests..." -ForegroundColor Yellow
Read-Host

# Test HR Service
Write-Host "`n=== Testing HR Service ===" -ForegroundColor Cyan

# Create employees
$emp1 = Test-Endpoint -Method "POST" -Url "$hrService/employees" -Body $employee1 -Description "Creating Employee 1 (Alice)"
$emp2 = Test-Endpoint -Method "POST" -Url "$hrService/employees" -Body $employee2 -Description "Creating Employee 2 (Bob)"

Start-Sleep -Seconds 2

# Get all employees
Test-Endpoint -Method "GET" -Url "$hrService/employees" -Description "Getting all employees"

# Test Matching Engine
Write-Host "`n=== Testing Matching Engine ===" -ForegroundColor Cyan

# Create a task
$task = Test-Endpoint -Method "POST" -Url "$matchingEngine/tasks" -Body $task1 -Description "Creating a task"

Start-Sleep -Seconds 2

if ($task -and $task.id) {
    # Get recommendations
    Test-Endpoint -Method "GET" -Url "$matchingEngine/tasks/$($task.id)/recommendations" -Description "Getting task recommendations"
}

# Get statistics
Test-Endpoint -Method "GET" -Url "$matchingEngine/stats" -Description "Getting matching statistics"

# Test Edge Agent (Blockchain integration)
Write-Host "`n=== Testing Edge Agent ===" -ForegroundColor Cyan

# Create employee via edge agent
$edgeEmployee = @{
    eventType = "edge/employee/create"
    data = @{
        id = "EMP003"
        name = "Charlie Davis"
        department = "Security"
        skills = @("Security", "Compliance", "Blockchain")
    }
} | ConvertTo-Json

Test-Endpoint -Method "POST" -Url "$edgeAgent/trigger-event" -Body $edgeEmployee -Description "Creating employee via Edge Agent (Blockchain)"

Start-Sleep -Seconds 3

# Add certification
$certification = @{
    eventType = "edge/certification/add"
    data = @{
        employeeId = "EMP003"
        certificationName = "Certified Kubernetes Administrator"
        issuer = "CNCF"
        issueDate = (Get-Date).AddMonths(-6).ToString("yyyy-MM-dd")
        expiryDate = (Get-Date).AddYears(2).ToString("yyyy-MM-dd")
    }
} | ConvertTo-Json

Test-Endpoint -Method "POST" -Url "$edgeAgent/trigger-event" -Body $certification -Description "Adding certification via Edge Agent"

# Test Verification Service
Write-Host "`n=== Testing Verification Service ===" -ForegroundColor Cyan

# Get employee credentials
Test-Endpoint -Method "GET" -Url "$verificationService/employees/EMP003/credentials" -Description "Getting employee credentials from blockchain"

# System status
Write-Host "`n=== System Status ===" -ForegroundColor Cyan
Test-Endpoint -Method "GET" -Url "$edgeAgent/status" -Description "Edge Agent Status"

Write-Host "`n=== Test Complete ===" -ForegroundColor Green
Write-Host "All basic functionality has been tested!" -ForegroundColor Green
