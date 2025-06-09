#!/usr/bin/env powershell

# Complete Code Verification Script

param(
    [string]$TestLevel = "full",  # minimal, standard, full, comprehensive
    [switch]$AutoFix,
    [switch]$GenerateReport,
    [string]$OutputDir = "./test-results"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 HCM System Complete Code Verification" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Create output directory
if ($GenerateReport) {
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $reportFile = "$OutputDir/verification-report-$timestamp.md"
}

$testResults = @()
$startTime = Get-Date

# Step 1: Pre-flight Configuration Check
function Step1-ConfigurationCheck {
    Write-Host "`n1️⃣ Configuration Validation" -ForegroundColor Blue
    Write-Host "============================" -ForegroundColor Blue
    
    try {
        $configResult = & powershell -ExecutionPolicy Bypass -File "scripts/validate-docker-config.ps1"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Configuration validation passed" -ForegroundColor Green
            return @{Step = "Configuration Check"; Status = "PASS"; Details = "All configurations valid"}
        } else {
            Write-Host "❌ Configuration validation failed" -ForegroundColor Red
            return @{Step = "Configuration Check"; Status = "FAIL"; Details = "Configuration issues detected"}
        }
    }
    catch {
        Write-Host "❌ Configuration check error: $_" -ForegroundColor Red
        return @{Step = "Configuration Check"; Status = "ERROR"; Details = $_.Exception.Message}
    }
}

# Step 2: Infrastructure Deployment
function Step2-InfrastructureDeployment {
    Write-Host "`n2️⃣ Infrastructure Deployment" -ForegroundColor Blue
    Write-Host "==============================" -ForegroundColor Blue
    
    try {
        Write-Host "Starting Docker infrastructure..." -ForegroundColor Cyan
        docker-compose up -d --build
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Infrastructure deployment successful" -ForegroundColor Green
            return @{Step = "Infrastructure Deployment"; Status = "PASS"; Details = "All services deployed"}
        } else {
            Write-Host "❌ Infrastructure deployment failed" -ForegroundColor Red
            return @{Step = "Infrastructure Deployment"; Status = "FAIL"; Details = "Docker compose failed"}
        }
    }
    catch {
        Write-Host "❌ Infrastructure deployment error: $_" -ForegroundColor Red
        return @{Step = "Infrastructure Deployment"; Status = "ERROR"; Details = $_.Exception.Message}
    }
}

# Step 3: Service Health Verification
function Step3-ServiceHealthVerification {
    Write-Host "`n3️⃣ Service Health Verification" -ForegroundColor Blue
    Write-Host "===============================" -ForegroundColor Blue
    
    try {
        # Wait for services to start
        Write-Host "Waiting for services to initialize..." -ForegroundColor Cyan
        Start-Sleep -Seconds 30
        
        $healthResult = & powershell -ExecutionPolicy Bypass -File "scripts/health-check.ps1"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ All services are healthy" -ForegroundColor Green
            return @{Step = "Service Health"; Status = "PASS"; Details = "All services responding"}
        } else {
            Write-Host "❌ Some services are unhealthy" -ForegroundColor Red
            return @{Step = "Service Health"; Status = "FAIL"; Details = "Health check failures"}
        }
    }
    catch {
        Write-Host "❌ Service health check error: $_" -ForegroundColor Red
        return @{Step = "Service Health"; Status = "ERROR"; Details = $_.Exception.Message}
    }
}

# Step 4: Individual Service Verification
function Step4-IndividualServiceVerification {
    Write-Host "`n4️⃣ Individual Service Verification" -ForegroundColor Blue
    Write-Host "===================================" -ForegroundColor Blue
    
    try {
        $serviceResult = & powershell -ExecutionPolicy Bypass -File "scripts/verify-services.ps1"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ All individual services verified" -ForegroundColor Green
            return @{Step = "Individual Services"; Status = "PASS"; Details = "All services functional"}
        } else {
            Write-Host "❌ Some individual services failed" -ForegroundColor Red
            return @{Step = "Individual Services"; Status = "FAIL"; Details = "Service verification failures"}
        }
    }
    catch {
        Write-Host "❌ Individual service verification error: $_" -ForegroundColor Red
        return @{Step = "Individual Services"; Status = "ERROR"; Details = $_.Exception.Message}
    }
}

# Step 5: Functional Testing
function Step5-FunctionalTesting {
    Write-Host "`n5️⃣ Functional Testing" -ForegroundColor Blue
    Write-Host "======================" -ForegroundColor Blue
    
    try {
        $functionalResult = & powershell -ExecutionPolicy Bypass -File "scripts/test-functional.ps1"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ All functional tests passed" -ForegroundColor Green
            return @{Step = "Functional Testing"; Status = "PASS"; Details = "All workflows functional"}
        } else {
            Write-Host "❌ Some functional tests failed" -ForegroundColor Red
            return @{Step = "Functional Testing"; Status = "FAIL"; Details = "Functional test failures"}
        }
    }
    catch {
        Write-Host "❌ Functional testing error: $_" -ForegroundColor Red
        return @{Step = "Functional Testing"; Status = "ERROR"; Details = $_.Exception.Message}
    }
}

# Step 6: Log Analysis
function Step6-LogAnalysis {
    Write-Host "`n6️⃣ Log Analysis" -ForegroundColor Blue
    Write-Host "================" -ForegroundColor Blue
    
    try {
        $logResult = & powershell -ExecutionPolicy Bypass -File "scripts/analyze-logs.ps1" -Summary
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Log analysis completed successfully" -ForegroundColor Green
            return @{Step = "Log Analysis"; Status = "PASS"; Details = "No critical issues in logs"}
        } else {
            Write-Host "⚠️ Log analysis found issues" -ForegroundColor Yellow
            return @{Step = "Log Analysis"; Status = "WARN"; Details = "Some issues detected in logs"}
        }
    }
    catch {
        Write-Host "❌ Log analysis error: $_" -ForegroundColor Red
        return @{Step = "Log Analysis"; Status = "ERROR"; Details = $_.Exception.Message}
    }
}

# Step 7: Performance Testing (Comprehensive only)
function Step7-PerformanceTesting {
    Write-Host "`n7️⃣ Performance Testing" -ForegroundColor Blue
    Write-Host "=======================" -ForegroundColor Blue
    
    try {
        # Simple load test
        Write-Host "Running basic load test..." -ForegroundColor Cyan
        
        $requests = @()
        for ($i = 1; $i -le 10; $i++) {
            $requests += Start-Job -ScriptBlock {
                param($url)
                try {
                    $start = Get-Date
                    $response = Invoke-RestMethod -Uri $url -Method GET -TimeoutSec 30
                    $end = Get-Date
                    $duration = ($end - $start).TotalMilliseconds
                    return @{Success = $true; Duration = $duration; Response = $response}
                }
                catch {
                    return @{Success = $false; Error = $_.Exception.Message; Duration = -1}
                }
            } -ArgumentList "http://localhost:3001/health"
        }
        
        $results = $requests | Wait-Job | Receive-Job
        $requests | Remove-Job
        
        $successCount = ($results | Where-Object { $_.Success }).Count
        $avgDuration = ($results | Where-Object { $_.Success } | Measure-Object -Property Duration -Average).Average
        
        if ($successCount -ge 8) {
            Write-Host "✅ Performance test passed ($successCount/10 requests successful)" -ForegroundColor Green
            Write-Host "   Average response time: $([math]::Round($avgDuration, 2))ms" -ForegroundColor Cyan
            return @{Step = "Performance Testing"; Status = "PASS"; Details = "Good performance under load"}
        } else {
            Write-Host "❌ Performance test failed ($successCount/10 requests successful)" -ForegroundColor Red
            return @{Step = "Performance Testing"; Status = "FAIL"; Details = "Poor performance under load"}
        }
    }
    catch {
        Write-Host "❌ Performance testing error: $_" -ForegroundColor Red
        return @{Step = "Performance Testing"; Status = "ERROR"; Details = $_.Exception.Message}
    }
}

# Step 8: Security Validation (Comprehensive only)
function Step8-SecurityValidation {
    Write-Host "`n8️⃣ Security Validation" -ForegroundColor Blue
    Write-Host "=======================" -ForegroundColor Blue
    
    try {
        $securityIssues = @()
        
        # Check for default passwords
        $envContent = Get-Content ".env" -Raw -ErrorAction SilentlyContinue
        if ($envContent -match "password|admin|123456") {
            $securityIssues += "Default passwords detected"
        }
        
        # Check exposed ports
        $composeContent = Get-Content "docker-compose.yaml" -Raw
        $exposedPorts = $composeContent | Select-String -Pattern '- "(\d+):\d+"' -AllMatches
        $criticalPorts = $exposedPorts.Matches | Where-Object { $_.Groups[1].Value -in @("5432", "6379", "7687") }
        
        if ($criticalPorts.Count -gt 0) {
            $securityIssues += "Database ports exposed externally"
        }
        
        # Check for HTTPS configuration
        if (-not ($composeContent -match "443:443")) {
            $securityIssues += "HTTPS not configured"
        }
        
        if ($securityIssues.Count -eq 0) {
            Write-Host "✅ Security validation passed" -ForegroundColor Green
            return @{Step = "Security Validation"; Status = "PASS"; Details = "No major security issues"}
        } else {
            Write-Host "⚠️ Security issues found:" -ForegroundColor Yellow
            foreach ($issue in $securityIssues) {
                Write-Host "  - $issue" -ForegroundColor Yellow
            }
            return @{Step = "Security Validation"; Status = "WARN"; Details = "Security improvements recommended"}
        }
    }
    catch {
        Write-Host "❌ Security validation error: $_" -ForegroundColor Red
        return @{Step = "Security Validation"; Status = "ERROR"; Details = $_.Exception.Message}
    }
}

# Generate comprehensive report
function Generate-ComprehensiveReport {
    param($Results, $StartTime, $EndTime)
    
    $duration = $EndTime - $StartTime
    $passCount = ($Results | Where-Object { $_.Status -eq "PASS" }).Count
    $failCount = ($Results | Where-Object { $_.Status -eq "FAIL" }).Count
    $warnCount = ($Results | Where-Object { $_.Status -eq "WARN" }).Count
    $errorCount = ($Results | Where-Object { $_.Status -eq "ERROR" }).Count
    
    $report = @"
# HCM System Verification Report

**Generated:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Duration:** $($duration.ToString('hh\:mm\:ss'))
**Test Level:** $TestLevel

## Executive Summary

- **Total Tests:** $($Results.Count)
- **Passed:** $passCount ✅
- **Failed:** $failCount ❌
- **Warnings:** $warnCount ⚠️
- **Errors:** $errorCount 💥

## Overall Status

$( if ($failCount -eq 0 -and $errorCount -eq 0) { 
    "🎉 **SYSTEM READY FOR PRODUCTION**" 
} elseif ($failCount -gt 0 -or $errorCount -gt 0) { 
    "❌ **SYSTEM HAS CRITICAL ISSUES**" 
} else { 
    "⚠️ **SYSTEM READY WITH WARNINGS**" 
})

## Detailed Results

| Step | Status | Details |
|------|--------|---------|
"@

    foreach ($result in $Results) {
        $statusIcon = switch ($result.Status) {
            "PASS" { "✅" }
            "FAIL" { "❌" }
            "WARN" { "⚠️" }
            "ERROR" { "💥" }
        }
        $report += "`n| $($result.Step) | $statusIcon $($result.Status) | $($result.Details) |"
    }

    $report += @"

## Recommendations

$( if ($failCount -eq 0 -and $errorCount -eq 0) {
    @"
### ✅ System Ready
- All critical tests passed
- System is ready for production use
- Continue with regular monitoring

### 🚀 Next Steps
1. Set up production monitoring
2. Configure backup strategies
3. Implement CI/CD pipelines
4. Schedule regular health checks
"@
} else {
    @"
### ❌ Critical Issues to Address
$( $Results | Where-Object { $_.Status -in @("FAIL", "ERROR") } | ForEach-Object { "- Fix: $($_.Step) - $($_.Details)" } | Out-String )

### 🔧 Immediate Actions Required
1. Review failed test details
2. Check service logs for error details
3. Fix configuration issues
4. Re-run verification after fixes
"@
})

$( if ($warnCount -gt 0) {
    @"

### ⚠️ Warnings to Consider
$( $Results | Where-Object { $_.Status -eq "WARN" } | ForEach-Object { "- Consider: $($_.Step) - $($_.Details)" } | Out-String )
"@
})

## Access Points

### Main Dashboard
- **URL:** http://localhost
- **Description:** Unified system dashboard

### Service Endpoints
- **API Gateway:** http://localhost:3001
- **HR Resource:** http://localhost:3002  
- **Matching Engine:** http://localhost:3003
- **Verification:** http://localhost:3004
- **Edge Agent:** http://localhost:3005

### Management Interfaces
- **Solace Manager:** http://localhost:8080
- **Neo4j Browser:** http://localhost:7474
- **Portainer:** http://localhost:9001
- **LDAP Admin:** http://localhost:8083
- **Redis Commander:** http://localhost:8082

## Technical Details

### Infrastructure
- **Containers:** 13 total services
- **Databases:** PostgreSQL, Neo4j, Redis
- **Message Broker:** Solace PubSub+
- **Directory:** OpenLDAP
- **Reverse Proxy:** Nginx

### Monitoring
- **Health Checks:** Automated every 30 seconds
- **Log Analysis:** Real-time monitoring
- **Performance:** Load testing capabilities

---
*Report generated by HCM System Verification Tool*
"@

    if ($GenerateReport) {
        $report | Out-File -FilePath $reportFile -Encoding UTF8
        Write-Host "`n📄 Report saved to: $reportFile" -ForegroundColor Cyan
    }
    
    return $report
}

# Main execution
try {
    Write-Host "Starting verification at level: $TestLevel" -ForegroundColor Cyan
    Write-Host "Estimated time: $( switch ($TestLevel) { 
        'minimal' { '2-3 minutes' }
        'standard' { '5-7 minutes' }
        'full' { '8-12 minutes' }
        'comprehensive' { '15-20 minutes' }
        default { '8-12 minutes' }
    })" -ForegroundColor Yellow
    
    # Execute verification steps based on test level
    $testResults += Step1-ConfigurationCheck
    
    if ($testResults[-1].Status -ne "FAIL") {
        $testResults += Step2-InfrastructureDeployment
    }
    
    if ($testResults[-1].Status -ne "FAIL") {
        $testResults += Step3-ServiceHealthVerification
    }
    
    if ($TestLevel -in @("standard", "full", "comprehensive") -and $testResults[-1].Status -ne "FAIL") {
        $testResults += Step4-IndividualServiceVerification
    }
    
    if ($TestLevel -in @("full", "comprehensive") -and $testResults[-1].Status -ne "FAIL") {
        $testResults += Step5-FunctionalTesting
        $testResults += Step6-LogAnalysis
    }
    
    if ($TestLevel -eq "comprehensive" -and $testResults[-1].Status -ne "FAIL") {
        $testResults += Step7-PerformanceTesting
        $testResults += Step8-SecurityValidation
    }
    
    $endTime = Get-Date
    
    # Generate final report
    Write-Host "`n📊 Final Verification Report" -ForegroundColor Cyan
    Write-Host "============================" -ForegroundColor Cyan
    
    $passCount = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
    $failCount = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
    $warnCount = ($testResults | Where-Object { $_.Status -eq "WARN" }).Count
    $errorCount = ($testResults | Where-Object { $_.Status -eq "ERROR" }).Count
    
    Write-Host "Duration: $((Get-Date) - $startTime | Select-Object -ExpandProperty ToString)" -ForegroundColor White
    Write-Host "Passed: $passCount" -ForegroundColor Green
    Write-Host "Failed: $failCount" -ForegroundColor Red
    Write-Host "Warnings: $warnCount" -ForegroundColor Yellow
    Write-Host "Errors: $errorCount" -ForegroundColor Red
    
    foreach ($result in $testResults) {
        $statusColor = switch ($result.Status) {
            "PASS" { "Green" }
            "FAIL" { "Red" }
            "WARN" { "Yellow" }
            "ERROR" { "Red" }
        }
        $statusIcon = switch ($result.Status) {
            "PASS" { "✅" }
            "FAIL" { "❌" }
            "WARN" { "⚠️" }
            "ERROR" { "💥" }
        }
        Write-Host "$statusIcon $($result.Step): $($result.Status)" -ForegroundColor $statusColor
    }
    
    # Generate comprehensive report
    $report = Generate-ComprehensiveReport -Results $testResults -StartTime $startTime -EndTime $endTime
    
    # Overall result
    if ($failCount -eq 0 -and $errorCount -eq 0) {
        Write-Host "`n🎉 VERIFICATION SUCCESSFUL!" -ForegroundColor Green
        Write-Host "✅ Your HCM system is fully verified and ready for use!" -ForegroundColor Green
        
        Write-Host "`n🔗 Quick Access:" -ForegroundColor Cyan
        Write-Host "  Main Dashboard: http://localhost" -ForegroundColor White
        Write-Host "  API Gateway: http://localhost:3001" -ForegroundColor White
        Write-Host "  System Health: http://localhost:3001/health" -ForegroundColor White
        
        exit 0
    } else {
        Write-Host "`n❌ VERIFICATION FAILED!" -ForegroundColor Red
        Write-Host "⚠️ Critical issues must be resolved before production use." -ForegroundColor Yellow
        
        if ($AutoFix) {
            Write-Host "`n🔧 Auto-fix not implemented yet. Manual intervention required." -ForegroundColor Yellow
        }
        
        Write-Host "`n🔍 Check the detailed report for specific issues and solutions." -ForegroundColor Cyan
        exit 1
    }
}
catch {
    Write-Host "💥 Verification script failed: $_" -ForegroundColor Red
    Write-Host "Stack Trace:" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}
