#!/usr/bin/env powershell

# Docker Environment Complete Test Script

param(
    [string]$TestType = "full",  # full, quick, infra-only
    [switch]$Verbose,
    [switch]$Cleanup
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 HCM Docker Environment Test Suite" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Cleanup function
function Cleanup-Environment {
    Write-Host "🧹 Cleaning up Docker environment..." -ForegroundColor Yellow
    
    try {
        docker-compose down -v --remove-orphans
        docker system prune -f
        Write-Host "✅ Cleanup completed" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️ Cleanup had some issues: $_" -ForegroundColor Yellow
    }
}

# Pre-flight checks
function Test-Prerequisites {
    Write-Host "📋 Checking prerequisites..." -ForegroundColor Blue
    
    # Check Docker
    try {
        $dockerVersion = docker --version
        Write-Host "✅ Docker: $dockerVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Docker not found. Please install Docker Desktop." -ForegroundColor Red
        exit 1
    }
    
    # Check Docker Compose
    try {
        $composeVersion = docker-compose --version
        Write-Host "✅ Docker Compose: $composeVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Docker Compose not found." -ForegroundColor Red
        exit 1
    }
    
    # Check available disk space (minimum 5GB)
    $freeSpace = (Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object -ExpandProperty FreeSpace) / 1GB
    if ($freeSpace -lt 5) {
        Write-Host "⚠️ Low disk space: ${freeSpace}GB available. Minimum 5GB recommended." -ForegroundColor Yellow
    } else {
        Write-Host "✅ Disk space: ${freeSpace}GB available" -ForegroundColor Green
    }
    
    # Check memory
    $totalMemory = (Get-WmiObject -Class Win32_ComputerSystem | Select-Object -ExpandProperty TotalPhysicalMemory) / 1GB
    if ($totalMemory -lt 8) {
        Write-Host "⚠️ Limited RAM: ${totalMemory}GB. 8GB+ recommended for full stack." -ForegroundColor Yellow
    } else {
        Write-Host "✅ Memory: ${totalMemory}GB available" -ForegroundColor Green
    }
}

# Build and start services
function Start-Services {
    param([string]$Mode)
    
    Write-Host "🔨 Building and starting services ($Mode)..." -ForegroundColor Blue
    
    try {
        switch ($Mode) {
            "infra" {
                Write-Host "Starting infrastructure services only..." -ForegroundColor Cyan
                docker-compose up -d redis neo4j postgres openldap solace portainer redis-commander ldap-admin
            }
            "apps" {
                Write-Host "Starting application services..." -ForegroundColor Cyan
                docker-compose up -d --build api-gateway hr-resource matching-engine verification edge-agent
            }
            "full" {
                Write-Host "Starting all services..." -ForegroundColor Cyan
                docker-compose up -d --build
            }
        }
        
        Write-Host "✅ Services started" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Failed to start services: $_" -ForegroundColor Red
        return $false
    }
}

# Wait for services to be ready
function Wait-ForServices {
    Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Blue
    
    $maxWait = 180  # 3 minutes
    $waited = 0
    
    while ($waited -lt $maxWait) {
        $healthyCount = 0
        $totalCount = 0
        
        try {
            $containers = docker-compose ps --format json | ConvertFrom-Json
            foreach ($container in $containers) {
                $totalCount++
                if ($container.State -eq "running") {
                    $healthyCount++
                }
            }
            
            $percentage = ($healthyCount / $totalCount) * 100
            Write-Progress -Activity "Waiting for services" -Status "$healthyCount/$totalCount services running" -PercentComplete $percentage
            
            if ($healthyCount -eq $totalCount) {
                Write-Host "✅ All services are running" -ForegroundColor Green
                return $true
            }
        }
        catch {
            Write-Host "⚠️ Error checking service status: $_" -ForegroundColor Yellow
        }
        
        Start-Sleep -Seconds 5
        $waited += 5
    }
    
    Write-Host "❌ Timeout waiting for services to start" -ForegroundColor Red
    return $false
}

# Test service connectivity
function Test-ServiceConnectivity {
    Write-Host "🔗 Testing service connectivity..." -ForegroundColor Blue
    
    $services = @(
        @{Name="Nginx"; Url="http://localhost/health"; Expected=200},
        @{Name="API Gateway"; Url="http://localhost:3001/health"; Expected=200},
        @{Name="Neo4j"; Url="http://localhost:7474"; Expected=200},
        @{Name="Solace"; Url="http://localhost:8080"; Expected=200},
        @{Name="Portainer"; Url="http://localhost:9001"; Expected=200},
        @{Name="Redis Commander"; Url="http://localhost:8082"; Expected=200},
        @{Name="LDAP Admin"; Url="http://localhost:8083"; Expected=200}
    )
    
    $results = @()
    
    foreach ($service in $services) {
        try {
            $response = Invoke-WebRequest -Uri $service.Url -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq $service.Expected) {
                Write-Host "✅ $($service.Name): OK" -ForegroundColor Green
                $results += @{Service=$service.Name; Status="OK"; Response=$response.StatusCode}
            } else {
                Write-Host "⚠️ $($service.Name): Unexpected status $($response.StatusCode)" -ForegroundColor Yellow
                $results += @{Service=$service.Name; Status="Warning"; Response=$response.StatusCode}
            }
        }
        catch {
            Write-Host "❌ $($service.Name): Failed - $($_.Exception.Message)" -ForegroundColor Red
            $results += @{Service=$service.Name; Status="Failed"; Response="N/A"}
        }
    }
    
    return $results
}

# Test database connections
function Test-DatabaseConnections {
    Write-Host "🗄️ Testing database connections..." -ForegroundColor Blue
    
    $databases = @()
    
    # Test Redis
    try {
        $redisTest = docker exec hcm-redis redis-cli -a redispassword ping
        if ($redisTest -eq "PONG") {
            Write-Host "✅ Redis: Connected" -ForegroundColor Green
            $databases += @{Database="Redis"; Status="Connected"}
        } else {
            Write-Host "❌ Redis: Failed to connect" -ForegroundColor Red
            $databases += @{Database="Redis"; Status="Failed"}
        }
    }
    catch {
        Write-Host "❌ Redis: Error - $_" -ForegroundColor Red
        $databases += @{Database="Redis"; Status="Error"}
    }
    
    # Test PostgreSQL
    try {
        $pgTest = docker exec hcm-postgres pg_isready -U postgres
        if ($pgTest -match "accepting connections") {
            Write-Host "✅ PostgreSQL: Connected" -ForegroundColor Green
            $databases += @{Database="PostgreSQL"; Status="Connected"}
        } else {
            Write-Host "❌ PostgreSQL: Failed to connect" -ForegroundColor Red
            $databases += @{Database="PostgreSQL"; Status="Failed"}
        }
    }
    catch {
        Write-Host "❌ PostgreSQL: Error - $_" -ForegroundColor Red
        $databases += @{Database="PostgreSQL"; Status="Error"}
    }
    
    # Test Neo4j
    try {
        $neo4jTest = docker exec neo4j cypher-shell -u neo4j -p password "RETURN 1"
        if ($neo4jTest -match "1") {
            Write-Host "✅ Neo4j: Connected" -ForegroundColor Green
            $databases += @{Database="Neo4j"; Status="Connected"}
        } else {
            Write-Host "❌ Neo4j: Failed to connect" -ForegroundColor Red
            $databases += @{Database="Neo4j"; Status="Failed"}
        }
    }
    catch {
        Write-Host "❌ Neo4j: Error - $_" -ForegroundColor Red
        $databases += @{Database="Neo4j"; Status="Error"}
    }
    
    return $databases
}

# Generate test report
function Generate-TestReport {
    param(
        $ServiceResults,
        $DatabaseResults,
        $StartTime,
        $EndTime
    )
    
    $duration = $EndTime - $StartTime
    
    Write-Host "`n📊 Test Report" -ForegroundColor Cyan
    Write-Host "==============" -ForegroundColor Cyan
    Write-Host "Test Duration: $($duration.ToString('hh\:mm\:ss'))" -ForegroundColor White
    Write-Host "Start Time: $($StartTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
    Write-Host "End Time: $($EndTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
    
    Write-Host "`n🌐 Service Connectivity:" -ForegroundColor Yellow
    foreach ($result in $ServiceResults) {
        $color = switch ($result.Status) {
            "OK" { "Green" }
            "Warning" { "Yellow" }
            "Failed" { "Red" }
        }
        Write-Host "  $($result.Service): $($result.Status) ($($result.Response))" -ForegroundColor $color
    }
    
    Write-Host "`n🗄️ Database Connections:" -ForegroundColor Yellow
    foreach ($result in $DatabaseResults) {
        $color = switch ($result.Status) {
            "Connected" { "Green" }
            "Failed" { "Red" }
            "Error" { "Red" }
        }
        Write-Host "  $($result.Database): $($result.Status)" -ForegroundColor $color
    }
    
    # Overall status
    $serviceFailures = ($ServiceResults | Where-Object { $_.Status -eq "Failed" }).Count
    $dbFailures = ($DatabaseResults | Where-Object { $_.Status -ne "Connected" }).Count
    
    if ($serviceFailures -eq 0 -and $dbFailures -eq 0) {
        Write-Host "`n🎉 Overall Status: ALL TESTS PASSED" -ForegroundColor Green
        Write-Host "✅ Your HCM Docker environment is fully operational!" -ForegroundColor Green
        
        Write-Host "`n🔗 Access URLs:" -ForegroundColor Cyan
        Write-Host "  Main Dashboard: http://localhost" -ForegroundColor White
        Write-Host "  API Gateway: http://localhost:3001" -ForegroundColor White
        Write-Host "  Portainer: http://localhost:9001" -ForegroundColor White
        Write-Host "  Neo4j Browser: http://localhost:7474" -ForegroundColor White
        Write-Host "  Solace Manager: http://localhost:8080" -ForegroundColor White
        
        return $true
    } else {
        Write-Host "`n⚠️ Overall Status: SOME TESTS FAILED" -ForegroundColor Red
        Write-Host "Service Failures: $serviceFailures" -ForegroundColor Red
        Write-Host "Database Failures: $dbFailures" -ForegroundColor Red
        Write-Host "`n🔧 Troubleshooting:" -ForegroundColor Yellow
        Write-Host "  1. Check logs: docker-compose logs [service-name]" -ForegroundColor White
        Write-Host "  2. Restart failed services: docker-compose restart [service-name]" -ForegroundColor White
        Write-Host "  3. Check system resources (CPU, Memory, Disk)" -ForegroundColor White
        
        return $false
    }
}

# Main execution
try {
    $startTime = Get-Date
    
    if ($Cleanup) {
        Cleanup-Environment
        exit 0
    }
    
    # Prerequisites check
    Test-Prerequisites
    
    # Start services based on test type
    switch ($TestType) {
        "quick" {
            if (!(Start-Services -Mode "infra")) { exit 1 }
        }
        "infra-only" {
            if (!(Start-Services -Mode "infra")) { exit 1 }
        }
        "full" {
            if (!(Start-Services -Mode "full")) { exit 1 }
        }
        default {
            if (!(Start-Services -Mode "full")) { exit 1 }
        }
    }
    
    # Wait for services
    if (!(Wait-ForServices)) { exit 1 }
    
    # Additional wait for health checks
    Write-Host "⏳ Waiting additional 30 seconds for health checks..." -ForegroundColor Blue
    Start-Sleep -Seconds 30
    
    # Test connectivity
    $serviceResults = Test-ServiceConnectivity
    $databaseResults = Test-DatabaseConnections
    
    $endTime = Get-Date
    
    # Generate report
    $success = Generate-TestReport -ServiceResults $serviceResults -DatabaseResults $databaseResults -StartTime $startTime -EndTime $endTime
    
    if ($success) {
        exit 0
    } else {
        exit 1
    }
}
catch {
    Write-Host "💥 Test suite failed with error: $_" -ForegroundColor Red
    Write-Host "Stack Trace:" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}
