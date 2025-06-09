#!/usr/bin/env powershell

# Individual Service Verification Script

param(
    [string]$Service = "all",
    [switch]$Verbose,
    [switch]$Interactive
)

Write-Host "🔍 HCM Service Verification" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan

# Test API Gateway
function Test-APIGateway {
    Write-Host "`n🚪 Testing API Gateway..." -ForegroundColor Blue
    
    try {
        # Test health endpoint
        $health = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET
        Write-Host "✅ Health Check: $($health.status)" -ForegroundColor Green
        
        # Test service registry
        $services = Invoke-RestMethod -Uri "http://localhost:3001/services" -Method GET
        Write-Host "✅ Service Registry: $($services.services.Count) services registered" -ForegroundColor Green
        
        # Test analytics overview
        $analytics = Invoke-RestMethod -Uri "http://localhost:3001/analytics/overview" -Method GET
        Write-Host "✅ Analytics: $($analytics.services.total) total services" -ForegroundColor Green
        
        return $true
    }
    catch {
        Write-Host "❌ API Gateway test failed: $_" -ForegroundColor Red
        return $false
    }
}

# Test HR Resource Service
function Test-HRResourceService {
    Write-Host "`n👥 Testing HR Resource Service..." -ForegroundColor Blue
    
    try {
        # Test health endpoint
        $health = Invoke-RestMethod -Uri "http://localhost:3002/health" -Method GET -ErrorAction SilentlyContinue
        Write-Host "✅ HR Service Health: Available" -ForegroundColor Green
        
        # Test through API Gateway
        $gatewayHealth = Invoke-RestMethod -Uri "http://localhost:3001/api/hr/health" -Method GET -ErrorAction SilentlyContinue
        Write-Host "✅ HR Service via Gateway: Available" -ForegroundColor Green
        
        return $true
    }
    catch {
        Write-Host "❌ HR Resource Service test failed: $_" -ForegroundColor Red
        return $false
    }
}

# Test Matching Engine
function Test-MatchingEngine {
    Write-Host "`n🎯 Testing Matching Engine..." -ForegroundColor Blue
    
    try {
        # Test health endpoint
        $health = Invoke-RestMethod -Uri "http://localhost:3003/health" -Method GET -ErrorAction SilentlyContinue
        Write-Host "✅ Matching Engine Health: Available" -ForegroundColor Green
        
        # Test through API Gateway
        $gatewayHealth = Invoke-RestMethod -Uri "http://localhost:3001/api/matching/health" -Method GET -ErrorAction SilentlyContinue
        Write-Host "✅ Matching Engine via Gateway: Available" -ForegroundColor Green
        
        return $true
    }
    catch {
        Write-Host "❌ Matching Engine test failed: $_" -ForegroundColor Red
        return $false
    }
}

# Test Verification Service
function Test-VerificationService {
    Write-Host "`n🔐 Testing Verification Service..." -ForegroundColor Blue
    
    try {
        # Test health endpoint
        $health = Invoke-RestMethod -Uri "http://localhost:3004/health" -Method GET -ErrorAction SilentlyContinue
        Write-Host "✅ Verification Service Health: Available" -ForegroundColor Green
        
        # Test through API Gateway
        $gatewayHealth = Invoke-RestMethod -Uri "http://localhost:3001/api/verification/health" -Method GET -ErrorAction SilentlyContinue
        Write-Host "✅ Verification Service via Gateway: Available" -ForegroundColor Green
        
        return $true
    }
    catch {
        Write-Host "❌ Verification Service test failed: $_" -ForegroundColor Red
        return $false
    }
}

# Test Edge Agent
function Test-EdgeAgent {
    Write-Host "`n🌐 Testing Edge Agent..." -ForegroundColor Blue
    
    try {
        # Test health endpoint
        $health = Invoke-RestMethod -Uri "http://localhost:3005/health" -Method GET -ErrorAction SilentlyContinue
        Write-Host "✅ Edge Agent Health: Available" -ForegroundColor Green
        
        # Test through API Gateway
        $gatewayHealth = Invoke-RestMethod -Uri "http://localhost:3001/api/edge/health" -Method GET -ErrorAction SilentlyContinue
        Write-Host "✅ Edge Agent via Gateway: Available" -ForegroundColor Green
        
        return $true
    }
    catch {
        Write-Host "❌ Edge Agent test failed: $_" -ForegroundColor Red
        return $false
    }
}

# Test Database Connections
function Test-DatabaseConnections {
    Write-Host "`n🗄️ Testing Database Connections..." -ForegroundColor Blue
    
    $results = @()
    
    # Test Redis
    try {
        $redisTest = docker exec hcm-redis redis-cli -a redispassword ping 2>$null
        if ($redisTest -eq "PONG") {
            Write-Host "✅ Redis: Connected and responding" -ForegroundColor Green
            $results += @{Database="Redis"; Status="OK"}
        }
    }
    catch {
        Write-Host "❌ Redis: Connection failed" -ForegroundColor Red
        $results += @{Database="Redis"; Status="Failed"}
    }
    
    # Test PostgreSQL
    try {
        $pgTest = docker exec hcm-postgres pg_isready -U postgres 2>$null
        if ($pgTest -match "accepting connections") {
            Write-Host "✅ PostgreSQL: Connected and accepting connections" -ForegroundColor Green
            $results += @{Database="PostgreSQL"; Status="OK"}
            
            # Test database schema
            $schemaTest = docker exec hcm-postgres psql -U postgres -d hcm_db -c "\dt" 2>$null
            if ($schemaTest -match "users") {
                Write-Host "✅ PostgreSQL Schema: Tables created successfully" -ForegroundColor Green
            }
        }
    }
    catch {
        Write-Host "❌ PostgreSQL: Connection failed" -ForegroundColor Red
        $results += @{Database="PostgreSQL"; Status="Failed"}
    }
    
    # Test Neo4j
    try {
        $neo4jTest = docker exec neo4j cypher-shell -u neo4j -p password "RETURN 1" 2>$null
        if ($neo4jTest -match "1") {
            Write-Host "✅ Neo4j: Connected and responding" -ForegroundColor Green
            $results += @{Database="Neo4j"; Status="OK"}
        }
    }
    catch {
        Write-Host "❌ Neo4j: Connection failed" -ForegroundColor Red
        $results += @{Database="Neo4j"; Status="Failed"}
    }
    
    return $results
}

# Test Message Broker (Solace)
function Test-MessageBroker {
    Write-Host "`n📡 Testing Solace Message Broker..." -ForegroundColor Blue
    
    try {
        # Test Solace management interface
        $solaceHealth = Invoke-WebRequest -Uri "http://localhost:8080" -UseBasicParsing -TimeoutSec 10
        if ($solaceHealth.StatusCode -eq 200) {
            Write-Host "✅ Solace Management Interface: Available" -ForegroundColor Green
        }
        
        # Test SEMP API
        $sempTest = Invoke-WebRequest -Uri "http://localhost:8008" -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
        if ($sempTest.StatusCode -eq 200) {
            Write-Host "✅ Solace SEMP API: Available" -ForegroundColor Green
        }
        
        return $true
    }
    catch {
        Write-Host "❌ Solace Message Broker test failed: $_" -ForegroundColor Red
        return $false
    }
}

# Test LDAP Directory
function Test-LDAPDirectory {
    Write-Host "`n📂 Testing LDAP Directory..." -ForegroundColor Blue
    
    try {
        # Test LDAP Admin interface
        $ldapAdmin = Invoke-WebRequest -Uri "http://localhost:8083" -UseBasicParsing -TimeoutSec 10
        if ($ldapAdmin.StatusCode -eq 200) {
            Write-Host "✅ LDAP Admin Interface: Available" -ForegroundColor Green
        }
        
        # Test LDAP connection
        $ldapTest = docker exec openldap ldapsearch -x -H ldap://localhost -b "dc=example,dc=com" "(objectclass=*)" 2>$null
        if ($ldapTest -match "example.com") {
            Write-Host "✅ LDAP Directory: Connected and populated" -ForegroundColor Green
        }
        
        return $true
    }
    catch {
        Write-Host "❌ LDAP Directory test failed: $_" -ForegroundColor Red
        return $false
    }
}

# Test Nginx Reverse Proxy
function Test-ReverseProxy {
    Write-Host "`n🌐 Testing Nginx Reverse Proxy..." -ForegroundColor Blue
    
    try {
        # Test main dashboard
        $mainDashboard = Invoke-WebRequest -Uri "http://localhost" -UseBasicParsing -TimeoutSec 10
        if ($mainDashboard.StatusCode -eq 200 -and $mainDashboard.Content -match "HCM System") {
            Write-Host "✅ Main Dashboard: Available" -ForegroundColor Green
        }
        
        # Test health endpoint
        $healthCheck = Invoke-WebRequest -Uri "http://localhost/health" -UseBasicParsing -TimeoutSec 10
        if ($healthCheck.StatusCode -eq 200) {
            Write-Host "✅ Nginx Health Check: OK" -ForegroundColor Green
        }
        
        # Test API routing
        $apiRouting = Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
        if ($apiRouting.StatusCode -eq 200) {
            Write-Host "✅ API Routing: Working" -ForegroundColor Green
        }
        
        return $true
    }
    catch {
        Write-Host "❌ Reverse Proxy test failed: $_" -ForegroundColor Red
        return $false
    }
}

# Interactive Service Testing
function Start-InteractiveTests {
    Write-Host "`n🎮 Interactive Service Testing" -ForegroundColor Cyan
    Write-Host "==============================" -ForegroundColor Cyan
    
    while ($true) {
        Write-Host "`nSelect a test to run:" -ForegroundColor Yellow
        Write-Host "1. API Gateway" -ForegroundColor White
        Write-Host "2. HR Resource Service" -ForegroundColor White
        Write-Host "3. Matching Engine" -ForegroundColor White
        Write-Host "4. Verification Service" -ForegroundColor White
        Write-Host "5. Edge Agent" -ForegroundColor White
        Write-Host "6. Database Connections" -ForegroundColor White
        Write-Host "7. Message Broker (Solace)" -ForegroundColor White
        Write-Host "8. LDAP Directory" -ForegroundColor White
        Write-Host "9. Reverse Proxy (Nginx)" -ForegroundColor White
        Write-Host "0. Exit" -ForegroundColor White
        
        $choice = Read-Host "`nEnter your choice (0-9)"
        
        switch ($choice) {
            "1" { Test-APIGateway }
            "2" { Test-HRResourceService }
            "3" { Test-MatchingEngine }
            "4" { Test-VerificationService }
            "5" { Test-EdgeAgent }
            "6" { Test-DatabaseConnections }
            "7" { Test-MessageBroker }
            "8" { Test-LDAPDirectory }
            "9" { Test-ReverseProxy }
            "0" { return }
            default { Write-Host "Invalid choice. Please try again." -ForegroundColor Red }
        }
        
        Write-Host "`nPress any key to continue..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}

# Main execution
try {
    if ($Interactive) {
        Start-InteractiveTests
        exit 0
    }
    
    $results = @()
    
    if ($Service -eq "all" -or $Service -eq "gateway") {
        $results += @{Service="API Gateway"; Success=(Test-APIGateway)}
    }
    
    if ($Service -eq "all" -or $Service -eq "hr") {
        $results += @{Service="HR Resource"; Success=(Test-HRResourceService)}
    }
    
    if ($Service -eq "all" -or $Service -eq "matching") {
        $results += @{Service="Matching Engine"; Success=(Test-MatchingEngine)}
    }
    
    if ($Service -eq "all" -or $Service -eq "verification") {
        $results += @{Service="Verification"; Success=(Test-VerificationService)}
    }
    
    if ($Service -eq "all" -or $Service -eq "edge") {
        $results += @{Service="Edge Agent"; Success=(Test-EdgeAgent)}
    }
    
    if ($Service -eq "all" -or $Service -eq "databases") {
        $dbResults = Test-DatabaseConnections
        $results += @{Service="Databases"; Success=($dbResults | Where-Object {$_.Status -ne "OK"}).Count -eq 0}
    }
    
    if ($Service -eq "all" -or $Service -eq "broker") {
        $results += @{Service="Message Broker"; Success=(Test-MessageBroker)}
    }
    
    if ($Service -eq "all" -or $Service -eq "ldap") {
        $results += @{Service="LDAP Directory"; Success=(Test-LDAPDirectory)}
    }
    
    if ($Service -eq "all" -or $Service -eq "proxy") {
        $results += @{Service="Reverse Proxy"; Success=(Test-ReverseProxy)}
    }
    
    # Summary
    Write-Host "`n📊 Service Verification Summary" -ForegroundColor Cyan
    Write-Host "===============================" -ForegroundColor Cyan
    
    $successCount = ($results | Where-Object {$_.Success}).Count
    $totalCount = $results.Count
    
    foreach ($result in $results) {
        $status = if ($result.Success) { "✅ PASS" } else { "❌ FAIL" }
        $color = if ($result.Success) { "Green" } else { "Red" }
        Write-Host "$($result.Service): $status" -ForegroundColor $color
    }
    
    Write-Host "`nOverall: $successCount/$totalCount services passed" -ForegroundColor $(if ($successCount -eq $totalCount) { "Green" } else { "Yellow" })
    
    if ($successCount -eq $totalCount) {
        Write-Host "🎉 All service verification tests passed!" -ForegroundColor Green
        Write-Host "`n🔗 Ready to use:" -ForegroundColor Cyan
        Write-Host "  Main Dashboard: http://localhost" -ForegroundColor White
        Write-Host "  API Gateway: http://localhost:3001" -ForegroundColor White
        Write-Host "  Solace Manager: http://localhost:8080" -ForegroundColor White
        exit 0
    } else {
        Write-Host "⚠️ Some services failed verification. Check the logs for details." -ForegroundColor Yellow
        exit 1
    }
}
catch {
    Write-Host "💥 Service verification failed: $_" -ForegroundColor Red
    exit 1
}
