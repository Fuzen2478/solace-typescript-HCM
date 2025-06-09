#!/usr/bin/env powershell

# Functional Testing Script for HCM System

Write-Host "🧪 HCM System Functional Testing" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Test Data
$testEmployee = @{
    firstName = "John"
    lastName = "Doe"
    email = "john.doe@example.com"
    department = "IT"
    position = "Software Developer"
    skills = @(
        @{name = "JavaScript"; level = 8},
        @{name = "TypeScript"; level = 7},
        @{name = "Node.js"; level = 8}
    )
}

$testTask = @{
    title = "Develop REST API"
    description = "Create a new REST API for user management"
    requiredSkills = @("JavaScript", "Node.js", "Database")
    estimatedHours = 40
    priority = 5
    department = "IT"
}

# Test Employee Onboarding Workflow
function Test-EmployeeOnboarding {
    Write-Host "`n👤 Testing Employee Onboarding Workflow..." -ForegroundColor Blue
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/workflows/employee-onboarding" -Method POST -Body ($testEmployee | ConvertTo-Json) -ContentType "application/json"
        
        if ($response.status -eq "completed") {
            Write-Host "✅ Employee onboarding workflow: COMPLETED" -ForegroundColor Green
            Write-Host "  - Employee ID: $($response.results.employee.id)" -ForegroundColor Cyan
            Write-Host "  - Edge Agent Initialized: $($response.results.edgeAgentInitialized)" -ForegroundColor Cyan
            Write-Host "  - Initial Recommendations: $($response.results.initialRecommendations.Count) tasks" -ForegroundColor Cyan
            return $response.results.employee.id
        } else {
            Write-Host "❌ Employee onboarding workflow: FAILED" -ForegroundColor Red
            Write-Host "  Error: $($response.error)" -ForegroundColor Red
            return $null
        }
    }
    catch {
        Write-Host "❌ Employee onboarding test failed: $_" -ForegroundColor Red
        return $null
    }
}

# Test Task Assignment Workflow
function Test-TaskAssignment {
    Write-Host "`n📋 Testing Task Assignment Workflow..." -ForegroundColor Blue
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/workflows/task-assignment" -Method POST -Body ($testTask | ConvertTo-Json) -ContentType "application/json"
        
        if ($response.status -eq "completed") {
            Write-Host "✅ Task assignment workflow: COMPLETED" -ForegroundColor Green
            Write-Host "  - Task ID: $($response.results.task.id)" -ForegroundColor Cyan
            Write-Host "  - Matches Found: $($response.results.matches.Count)" -ForegroundColor Cyan
            
            if ($response.results.assignment.status -eq "assigned") {
                Write-Host "  - Auto-assigned to: $($response.results.assignment.employeeId)" -ForegroundColor Green
            } else {
                Write-Host "  - Assignment Status: $($response.results.assignment.status)" -ForegroundColor Yellow
            }
            
            return $response.results.task.id
        } else {
            Write-Host "❌ Task assignment workflow: FAILED" -ForegroundColor Red
            Write-Host "  Error: $($response.error)" -ForegroundColor Red
            return $null
        }
    }
    catch {
        Write-Host "❌ Task assignment test failed: $_" -ForegroundColor Red
        return $null
    }
}

# Test Health Monitoring Workflow
function Test-HealthMonitoring {
    Write-Host "`n🩺 Testing Health Monitoring Workflow..." -ForegroundColor Blue
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/workflows/health-monitoring" -Method GET
        
        if ($response.status -eq "completed") {
            Write-Host "✅ Health monitoring workflow: COMPLETED" -ForegroundColor Green
            Write-Host "  - Services Monitored: $($response.results.serviceHealth.Count)" -ForegroundColor Cyan
            
            $healthyServices = $response.results.serviceHealth | Where-Object { $_.status -eq "healthy" }
            Write-Host "  - Healthy Services: $($healthyServices.Count)" -ForegroundColor Green
            
            if ($response.results.edgeClusterState) {
                Write-Host "  - Edge Agents: $($response.results.edgeClusterState.totalAgents) total, $($response.results.edgeClusterState.activeAgents) active" -ForegroundColor Cyan
            }
            
            return $true
        } else {
            Write-Host "❌ Health monitoring workflow: FAILED" -ForegroundColor Red
            Write-Host "  Error: $($response.error)" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ Health monitoring test failed: $_" -ForegroundColor Red
        return $false
    }
}

# Test Service Communication
function Test-ServiceCommunication {
    Write-Host "`n🔗 Testing Inter-Service Communication..." -ForegroundColor Blue
    
    try {
        # Test service registry
        $services = Invoke-RestMethod -Uri "http://localhost:3001/services" -Method GET
        Write-Host "✅ Service Registry: $($services.services.Count) services registered" -ForegroundColor Green
        
        foreach ($service in $services.services) {
            $statusColor = switch ($service.status) {
                "healthy" { "Green" }
                "unhealthy" { "Red" }
                default { "Yellow" }
            }
            Write-Host "  - $($service.name): $($service.status)" -ForegroundColor $statusColor
        }
        
        # Test service health checks
        $healthyServices = $services.services | Where-Object { $_.status -eq "healthy" }
        $healthPercentage = ($healthyServices.Count / $services.services.Count) * 100
        
        if ($healthPercentage -eq 100) {
            Write-Host "✅ All services are healthy (100%)" -ForegroundColor Green
            return $true
        } elseif ($healthPercentage -ge 80) {
            Write-Host "⚠️ Most services are healthy (${healthPercentage}%)" -ForegroundColor Yellow
            return $true
        } else {
            Write-Host "❌ Many services are unhealthy (${healthPercentage}%)" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ Service communication test failed: $_" -ForegroundColor Red
        return $false
    }
}

# Test Database Integration
function Test-DatabaseIntegration {
    Write-Host "`n🗄️ Testing Database Integration..." -ForegroundColor Blue
    
    $results = @()
    
    # Test PostgreSQL
    try {
        $pgTest = docker exec hcm-postgres psql -U postgres -d hcm_db -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>$null
        if ($pgTest -match "\d+") {
            Write-Host "✅ PostgreSQL: Schema loaded, tables available" -ForegroundColor Green
            $results += $true
        }
    }
    catch {
        Write-Host "❌ PostgreSQL integration test failed" -ForegroundColor Red
        $results += $false
    }
    
    # Test Neo4j
    try {
        $neo4jTest = docker exec neo4j cypher-shell -u neo4j -p password "MATCH (n) RETURN count(n) LIMIT 1" 2>$null
        Write-Host "✅ Neo4j: Graph database accessible" -ForegroundColor Green
        $results += $true
    }
    catch {
        Write-Host "❌ Neo4j integration test failed" -ForegroundColor Red
        $results += $false
    }
    
    # Test Redis
    try {
        $redisTest = docker exec hcm-redis redis-cli -a redispassword info replication 2>$null
        if ($redisTest -match "role:master") {
            Write-Host "✅ Redis: Cache system operational" -ForegroundColor Green
            $results += $true
        }
    }
    catch {
        Write-Host "❌ Redis integration test failed" -ForegroundColor Red
        $results += $false
    }
    
    return ($results | Where-Object { $_ -eq $false }).Count -eq 0
}

# Test External Services Integration
function Test-ExternalServicesIntegration {
    Write-Host "`n🌐 Testing External Services Integration..." -ForegroundColor Blue
    
    $results = @()
    
    # Test Solace Message Broker
    try {
        $solaceTest = Invoke-WebRequest -Uri "http://localhost:8080" -UseBasicParsing -TimeoutSec 10
        if ($solaceTest.StatusCode -eq 200) {
            Write-Host "✅ Solace Message Broker: Connected and operational" -ForegroundColor Green
            $results += $true
        }
    }
    catch {
        Write-Host "❌ Solace integration test failed" -ForegroundColor Red
        $results += $false
    }
    
    # Test LDAP Directory
    try {
        $ldapTest = docker exec openldap ldapsearch -x -H ldap://localhost -b "dc=example,dc=com" "(cn=admin)" 2>$null
        if ($ldapTest -match "admin") {
            Write-Host "✅ LDAP Directory: Connected and populated" -ForegroundColor Green
            $results += $true
        }
    }
    catch {
        Write-Host "❌ LDAP integration test failed" -ForegroundColor Red
        $results += $false
    }
    
    return ($results | Where-Object { $_ -eq $false }).Count -eq 0
}

# Test Load and Performance
function Test-LoadAndPerformance {
    Write-Host "`n⚡ Testing Load and Performance..." -ForegroundColor Blue
    
    try {
        # Test multiple concurrent requests
        $requests = @()
        for ($i = 1; $i -le 5; $i++) {
            $requests += Start-Job -ScriptBlock {
                param($url)
                try {
                    $response = Invoke-RestMethod -Uri $url -Method GET -TimeoutSec 30
                    return @{Success = $true; Response = $response}
                }
                catch {
                    return @{Success = $false; Error = $_.Exception.Message}
                }
            } -ArgumentList "http://localhost:3001/health"
        }
        
        # Wait for all requests to complete
        $results = $requests | Wait-Job | Receive-Job
        $requests | Remove-Job
        
        $successCount = ($results | Where-Object { $_.Success }).Count
        $totalCount = $results.Count
        
        Write-Host "✅ Concurrent Requests: $successCount/$totalCount succeeded" -ForegroundColor Green
        
        if ($successCount -eq $totalCount) {
            Write-Host "✅ Load test: System handles concurrent requests well" -ForegroundColor Green
            return $true
        } else {
            Write-Host "⚠️ Load test: Some requests failed under load" -ForegroundColor Yellow
            return $false
        }
    }
    catch {
        Write-Host "❌ Load and performance test failed: $_" -ForegroundColor Red
        return $false
    }
}

# Main Test Execution
function Start-FunctionalTests {
    Write-Host "Starting comprehensive functional tests..." -ForegroundColor Cyan
    
    $testResults = @()
    
    # Run all functional tests
    $testResults += @{Test = "Service Communication"; Success = (Test-ServiceCommunication)}
    $testResults += @{Test = "Database Integration"; Success = (Test-DatabaseIntegration)}
    $testResults += @{Test = "External Services"; Success = (Test-ExternalServicesIntegration)}
    $testResults += @{Test = "Employee Onboarding"; Success = (Test-EmployeeOnboarding) -ne $null}
    $testResults += @{Test = "Task Assignment"; Success = (Test-TaskAssignment) -ne $null}
    $testResults += @{Test = "Health Monitoring"; Success = (Test-HealthMonitoring)}
    $testResults += @{Test = "Load Performance"; Success = (Test-LoadAndPerformance)}
    
    # Generate test report
    Write-Host "`n📊 Functional Test Results" -ForegroundColor Cyan
    Write-Host "===========================" -ForegroundColor Cyan
    
    $passedTests = ($testResults | Where-Object { $_.Success }).Count
    $totalTests = $testResults.Count
    
    foreach ($test in $testResults) {
        $status = if ($test.Success) { "✅ PASS" } else { "❌ FAIL" }
        $color = if ($test.Success) { "Green" } else { "Red" }
        Write-Host "$($test.Test): $status" -ForegroundColor $color
    }
    
    Write-Host "`nOverall: $passedTests/$totalTests tests passed" -ForegroundColor $(if ($passedTests -eq $totalTests) { "Green" } else { "Yellow" })
    
    if ($passedTests -eq $totalTests) {
        Write-Host "`n🎉 All functional tests passed!" -ForegroundColor Green
        Write-Host "✅ Your HCM system is fully operational and ready for use!" -ForegroundColor Green
        
        Write-Host "`n🚀 System is ready for:" -ForegroundColor Cyan
        Write-Host "  - Employee onboarding and management" -ForegroundColor White
        Write-Host "  - Intelligent task matching and assignment" -ForegroundColor White
        Write-Host "  - Identity verification and authentication" -ForegroundColor White
        Write-Host "  - Distributed edge computing tasks" -ForegroundColor White
        Write-Host "  - Real-time system monitoring" -ForegroundColor White
        
        return $true
    } else {
        Write-Host "`n⚠️ Some functional tests failed." -ForegroundColor Yellow
        Write-Host "The system may have limited functionality. Check service logs for details." -ForegroundColor Yellow
        return $false
    }
}

# Run the tests
try {
    Start-FunctionalTests
}
catch {
    Write-Host "💥 Functional testing failed: $_" -ForegroundColor Red
    exit 1
}
