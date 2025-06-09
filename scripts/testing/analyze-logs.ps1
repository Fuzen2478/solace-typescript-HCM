#!/usr/bin/env powershell

# Log Analysis and Debugging Script

param(
    [string]$Service = "all",
    [int]$Lines = 100,
    [switch]$Follow,
    [switch]$Errors,
    [switch]$Summary
)

Write-Host "📊 HCM System Log Analysis" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan

# Analyze logs for a specific service
function Analyze-ServiceLogs {
    param(
        [string]$ServiceName,
        [int]$LineCount = 100,
        [bool]$ErrorsOnly = $false
    )
    
    Write-Host "`n📋 Analyzing $ServiceName logs..." -ForegroundColor Blue
    
    try {
        $logCommand = "docker logs hcm-$ServiceName --tail $LineCount"
        if ($ErrorsOnly) {
            $logs = Invoke-Expression "$logCommand 2>&1" | Where-Object { $_ -match "ERROR|error|Error|FATAL|fatal|Fatal" }
        } else {
            $logs = Invoke-Expression "$logCommand 2>&1"
        }
        
        if ($logs) {
            # Count different log levels
            $errorCount = ($logs | Where-Object { $_ -match "ERROR|error|Error|FATAL|fatal|Fatal" }).Count
            $warningCount = ($logs | Where-Object { $_ -match "WARN|warn|Warn|WARNING|warning|Warning" }).Count
            $infoCount = ($logs | Where-Object { $_ -match "INFO|info|Info" }).Count
            
            Write-Host "  📊 Log Summary:" -ForegroundColor Cyan
            Write-Host "    Errors: $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })
            Write-Host "    Warnings: $warningCount" -ForegroundColor $(if ($warningCount -gt 0) { "Yellow" } else { "Green" })
            Write-Host "    Info: $infoCount" -ForegroundColor Green
            
            if ($errorCount -gt 0) {
                Write-Host "`n  🔴 Recent Errors:" -ForegroundColor Red
                $errors = $logs | Where-Object { $_ -match "ERROR|error|Error|FATAL|fatal|Fatal" } | Select-Object -Last 5
                foreach ($error in $errors) {
                    Write-Host "    $error" -ForegroundColor Red
                }
            }
            
            if ($warningCount -gt 0) {
                Write-Host "`n  🟡 Recent Warnings:" -ForegroundColor Yellow
                $warnings = $logs | Where-Object { $_ -match "WARN|warn|Warn|WARNING|warning|Warning" } | Select-Object -Last 3
                foreach ($warning in $warnings) {
                    Write-Host "    $warning" -ForegroundColor Yellow
                }
            }
            
            return @{
                Service = $ServiceName
                Errors = $errorCount
                Warnings = $warningCount
                Info = $infoCount
                Healthy = $errorCount -eq 0
            }
        } else {
            Write-Host "  ℹ️ No logs found for $ServiceName" -ForegroundColor Cyan
            return @{Service = $ServiceName; Errors = 0; Warnings = 0; Info = 0; Healthy = $true}
        }
    }
    catch {
        Write-Host "  ❌ Failed to analyze logs for $ServiceName: $_" -ForegroundColor Red
        return @{Service = $ServiceName; Errors = 1; Warnings = 0; Info = 0; Healthy = $false}
    }
}

# Follow logs in real-time
function Follow-ServiceLogs {
    param([string]$ServiceName)
    
    Write-Host "📡 Following $ServiceName logs in real-time..." -ForegroundColor Blue
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    
    try {
        if ($ServiceName -eq "all") {
            docker-compose logs -f
        } else {
            docker logs -f "hcm-$ServiceName"
        }
    }
    catch {
        Write-Host "❌ Failed to follow logs: $_" -ForegroundColor Red
    }
}

# Generate system health report based on logs
function Generate-HealthReport {
    Write-Host "`n🏥 Generating System Health Report..." -ForegroundColor Blue
    
    $services = @("api-gateway", "hr-resource", "matching-engine", "verification", "edge-agent", "redis", "postgres", "neo4j")
    $healthData = @()
    
    foreach ($service in $services) {
        $analysis = Analyze-ServiceLogs -ServiceName $service -LineCount 50 -ErrorsOnly $false
        $healthData += $analysis
    }
    
    Write-Host "`n📊 System Health Summary" -ForegroundColor Cyan
    Write-Host "=========================" -ForegroundColor Cyan
    
    $totalErrors = ($healthData | Measure-Object -Property Errors -Sum).Sum
    $totalWarnings = ($healthData | Measure-Object -Property Warnings -Sum).Sum
    $healthyServices = ($healthData | Where-Object { $_.Healthy }).Count
    $totalServices = $healthData.Count
    
    Write-Host "Overall Health: $healthyServices/$totalServices services healthy" -ForegroundColor $(if ($healthyServices -eq $totalServices) { "Green" } else { "Yellow" })
    Write-Host "Total Errors: $totalErrors" -ForegroundColor $(if ($totalErrors -eq 0) { "Green" } else { "Red" })
    Write-Host "Total Warnings: $totalWarnings" -ForegroundColor $(if ($totalWarnings -eq 0) { "Green" } else { "Yellow" })
    
    Write-Host "`n📋 Service Details:" -ForegroundColor Cyan
    foreach ($service in $healthData) {
        $status = if ($service.Healthy) { "✅ Healthy" } else { "❌ Issues" }
        $color = if ($service.Healthy) { "Green" } else { "Red" }
        Write-Host "$($service.Service): $status (E:$($service.Errors), W:$($service.Warnings))" -ForegroundColor $color
    }
    
    # Recommendations
    if ($totalErrors -gt 0 -or $totalWarnings -gt 5) {
        Write-Host "`n💡 Recommendations:" -ForegroundColor Yellow
        
        if ($totalErrors -gt 0) {
            Write-Host "  - Investigate and fix critical errors immediately" -ForegroundColor Red
            Write-Host "  - Check service configurations and dependencies" -ForegroundColor Yellow
        }
        
        if ($totalWarnings -gt 5) {
            Write-Host "  - Review warnings to prevent future issues" -ForegroundColor Yellow
            Write-Host "  - Consider adjusting resource limits or timeouts" -ForegroundColor Yellow
        }
        
        $unhealthyServices = $healthData | Where-Object { -not $_.Healthy }
        if ($unhealthyServices.Count -gt 0) {
            Write-Host "  - Restart unhealthy services: $($unhealthyServices.Service -join ', ')" -ForegroundColor Yellow
        }
    } else {
        Write-Host "`n🎉 System is running smoothly!" -ForegroundColor Green
    }
    
    return $healthData
}

# Check for common issues
function Check-CommonIssues {
    Write-Host "`n🔍 Checking for Common Issues..." -ForegroundColor Blue
    
    $issues = @()
    
    # Check for port conflicts
    try {
        $portConflicts = docker-compose ps --format "table {{.Name}}\t{{.Ports}}" | Where-Object { $_ -match "0.0.0.0" }
        if ($portConflicts) {
            Write-Host "✅ Ports are properly exposed" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Some ports may not be exposed" -ForegroundColor Yellow
            $issues += "Port exposure issues"
        }
    }
    catch {
        $issues += "Cannot check port status"
    }
    
    # Check for memory issues
    try {
        $memoryUsage = docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}"
        Write-Host "📊 Memory Usage:" -ForegroundColor Cyan
        Write-Host $memoryUsage -ForegroundColor White
    }
    catch {
        $issues += "Cannot check memory usage"
    }
    
    # Check for disk space
    try {
        $diskUsage = docker system df
        Write-Host "`n💾 Docker Disk Usage:" -ForegroundColor Cyan
        Write-Host $diskUsage -ForegroundColor White
    }
    catch {
        $issues += "Cannot check disk usage"
    }
    
    # Check for network connectivity
    try {
        $networkTest = docker network ls | Where-Object { $_ -match "hcm-network" }
        if ($networkTest) {
            Write-Host "`n✅ HCM network is available" -ForegroundColor Green
        } else {
            Write-Host "`n❌ HCM network is missing" -ForegroundColor Red
            $issues += "Network configuration issues"
        }
    }
    catch {
        $issues += "Cannot check network status"
    }
    
    if ($issues.Count -eq 0) {
        Write-Host "`n✅ No common issues detected" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️ Issues detected:" -ForegroundColor Yellow
        foreach ($issue in $issues) {
            Write-Host "  - $issue" -ForegroundColor Yellow
        }
    }
    
    return $issues
}

# Main execution
try {
    if ($Follow) {
        Follow-ServiceLogs -ServiceName $Service
        exit 0
    }
    
    if ($Summary) {
        $healthData = Generate-HealthReport
        $commonIssues = Check-CommonIssues
        
        if ($healthData.Count -eq ($healthData | Where-Object { $_.Healthy }).Count -and $commonIssues.Count -eq 0) {
            Write-Host "`n🎉 System is healthy and operating normally!" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "`n⚠️ System has some issues that need attention." -ForegroundColor Yellow
            exit 1
        }
    }
    
    if ($Service -eq "all") {
        $services = @("api-gateway", "hr-resource", "matching-engine", "verification", "edge-agent")
        foreach ($svc in $services) {
            Analyze-ServiceLogs -ServiceName $svc -LineCount $Lines -ErrorsOnly $Errors
        }
    } else {
        Analyze-ServiceLogs -ServiceName $Service -LineCount $Lines -ErrorsOnly $Errors
    }
}
catch {
    Write-Host "💥 Log analysis failed: $_" -ForegroundColor Red
    exit 1
}
