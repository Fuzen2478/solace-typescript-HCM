#!/usr/bin/env powershell

# Docker Configuration Validation Script

Write-Host "🔍 HCM Docker Configuration Validation" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

$issues = @()
$warnings = @()
$suggestions = @()

# Check if all required files exist
function Test-RequiredFiles {
    Write-Host "`n📁 Checking required files..." -ForegroundColor Blue
    
    $requiredFiles = @(
        "docker-compose.yaml",
        "Dockerfile",
        ".dockerignore",
        ".env.docker",
        ".env.local",
        "src/services/api-gateway/Dockerfile",
        "src/services/hr-resource/Dockerfile",
        "src/services/matching-engine/Dockerfile",
        "src/services/verification/Dockerfile",
        "src/services/edge-agent/Dockerfile",
        "development/Dockerfile.ldap",
        "nginx/nginx.conf",
        "sql/init.sql",
        "openldap/ldif/initial-data.ldif",
        "scripts/health-check.ps1",
        "scripts/health-check.sh"
    )
    
    foreach ($file in $requiredFiles) {
        if (Test-Path $file) {
            Write-Host "✅ $file" -ForegroundColor Green
        } else {
            Write-Host "❌ $file - MISSING" -ForegroundColor Red
            $script:issues += "Missing required file: $file"
        }
    }
}

# Check Docker Compose configuration
function Test-DockerComposeConfig {
    Write-Host "`n🐳 Validating docker-compose.yaml..." -ForegroundColor Blue
    
    try {
        $composeTest = docker-compose config 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ docker-compose.yaml syntax is valid" -ForegroundColor Green
        } else {
            Write-Host "❌ docker-compose.yaml has syntax errors:" -ForegroundColor Red
            Write-Host $composeTest -ForegroundColor Red
            $script:issues += "docker-compose.yaml syntax errors"
        }
    }
    catch {
        Write-Host "❌ Failed to validate docker-compose.yaml: $_" -ForegroundColor Red
        $script:issues += "Cannot validate docker-compose.yaml"
    }
}

# Check port conflicts
function Test-PortConflicts {
    Write-Host "`n🔌 Checking for port conflicts..." -ForegroundColor Blue
    
    $ports = @(80, 443, 389, 636, 1883, 2222, 3001, 3002, 3003, 3004, 3005, 3006, 3389, 5432, 5672, 6379, 7474, 7687, 8008, 8080, 8082, 8083, 9000, 9001, 55555)
    
    foreach ($port in $ports) {
        try {
            $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
            if ($connection) {
                Write-Host "⚠️ Port $port is already in use" -ForegroundColor Yellow
                $script:warnings += "Port $port is already in use"
            } else {
                Write-Host "✅ Port $port is available" -ForegroundColor Green
            }
        }
        catch {
            # Port is available
            Write-Host "✅ Port $port is available" -ForegroundColor Green
        }
    }
}

# Check environment variables consistency
function Test-EnvironmentVariables {
    Write-Host "`n🌍 Checking environment variables..." -ForegroundColor Blue
    
    $envFiles = @(".env", ".env.docker", ".env.local")
    $requiredVars = @(
        "NODE_ENV", "REDIS_URL", "NEO4J_URI", "POSTGRES_URL", 
        "SOLACE_HOST", "LDAP_URL", "API_GATEWAY_PORT"
    )
    
    foreach ($envFile in $envFiles) {
        if (Test-Path $envFile) {
            Write-Host "📄 Checking $envFile..." -ForegroundColor Cyan
            $content = Get-Content $envFile -Raw
            
            foreach ($var in $requiredVars) {
                if ($content -match "^$var=") {
                    Write-Host "  ✅ $var is defined" -ForegroundColor Green
                } else {
                    Write-Host "  ⚠️ $var is missing" -ForegroundColor Yellow
                    $script:warnings += "$var is missing in $envFile"
                }
            }
        } else {
            Write-Host "❌ $envFile not found" -ForegroundColor Red
            $script:issues += "$envFile not found"
        }
    }
}

# Check Docker network configuration
function Test-NetworkConfiguration {
    Write-Host "`n🌐 Checking network configuration..." -ForegroundColor Blue
    
    if (Test-Path "docker-compose.yaml") {
        $compose = Get-Content "docker-compose.yaml" -Raw
        
        if ($compose -match "networks:") {
            Write-Host "✅ Networks section found" -ForegroundColor Green
            
            if ($compose -match "hcm-network:") {
                Write-Host "✅ hcm-network defined" -ForegroundColor Green
            } else {
                Write-Host "❌ hcm-network not defined" -ForegroundColor Red
                $script:issues += "hcm-network not defined"
            }
            
            # Check if all services are on the network
            $services = @("neo4j", "openldap", "solace", "redis", "postgres", "api-gateway", "hr-resource", "matching-engine", "verification", "edge-agent", "nginx")
            foreach ($service in $services) {
                if ($compose -match "$service:" -and $compose -match "networks:.*hcm-network") {
                    # More detailed check needed
                    $serviceSection = ($compose -split "$service:")[1]
                    if ($serviceSection -match "networks:.*hcm-network" -or $compose -match "- hcm-network") {
                        Write-Host "  ✅ $service connected to hcm-network" -ForegroundColor Green
                    }
                }
            }
        } else {
            Write-Host "❌ No networks section found" -ForegroundColor Red
            $script:issues += "No networks section in docker-compose.yaml"
        }
    }
}

# Check volume configuration
function Test-VolumeConfiguration {
    Write-Host "`n💾 Checking volume configuration..." -ForegroundColor Blue
    
    if (Test-Path "docker-compose.yaml") {
        $compose = Get-Content "docker-compose.yaml" -Raw
        
        $expectedVolumes = @(
            "redis_data", "neo4j_data", "postgres_data", "portainer_data",
            "openldap_data", "openldap_config", "solace_data", "solace_var"
        )
        
        foreach ($volume in $expectedVolumes) {
            if ($compose -match "$volume:") {
                Write-Host "✅ Volume $volume defined" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Volume $volume not found" -ForegroundColor Yellow
                $script:warnings += "Volume $volume not found"
            }
        }
    }
}

# Check Dockerfile best practices
function Test-DockerfileBestPractices {
    Write-Host "`n🐋 Checking Dockerfile best practices..." -ForegroundColor Blue
    
    $dockerfiles = @(
        "Dockerfile",
        "src/services/api-gateway/Dockerfile",
        "src/services/hr-resource/Dockerfile", 
        "src/services/matching-engine/Dockerfile",
        "src/services/verification/Dockerfile",
        "src/services/edge-agent/Dockerfile",
        "development/Dockerfile.ldap"
    )
    
    foreach ($dockerfile in $dockerfiles) {
        if (Test-Path $dockerfile) {
            $content = Get-Content $dockerfile -Raw
            
            Write-Host "📄 Checking $dockerfile..." -ForegroundColor Cyan
            
            # Check for non-root user
            if ($content -match "USER") {
                Write-Host "  ✅ Non-root user configured" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️ No non-root user found" -ForegroundColor Yellow
                $script:warnings += "No non-root user in $dockerfile"
            }
            
            # Check for health check
            if ($content -match "HEALTHCHECK") {
                Write-Host "  ✅ Health check configured" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️ No health check found" -ForegroundColor Yellow
                $script:suggestions += "Consider adding health check to $dockerfile"
            }
            
            # Check for proper layer caching
            if ($content -match "COPY package.*json" -and $content -match "RUN.*install") {
                Write-Host "  ✅ Package files copied before dependencies" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️ Dependencies might not be cached properly" -ForegroundColor Yellow
                $script:suggestions += "Optimize layer caching in $dockerfile"
            }
            
            # Check for Alpine Linux (smaller images)
            if ($content -match "alpine") {
                Write-Host "  ✅ Using Alpine Linux (smaller image)" -ForegroundColor Green
            } else {
                Write-Host "  ℹ️ Not using Alpine Linux" -ForegroundColor Cyan
                $script:suggestions += "Consider using Alpine Linux in $dockerfile for smaller images"
            }
        }
    }
}

# Check security considerations
function Test-SecurityConfiguration {
    Write-Host "`n🔒 Checking security configuration..." -ForegroundColor Blue
    
    # Check .env files for default passwords
    $envFiles = @(".env", ".env.docker", ".env.local")
    $defaultPasswords = @("password", "admin", "123456", "secret", "test")
    
    foreach ($envFile in $envFiles) {
        if (Test-Path $envFile) {
            $content = Get-Content $envFile -Raw
            
            foreach ($password in $defaultPasswords) {
                if ($content -match "PASSWORD.*$password") {
                    Write-Host "⚠️ Default password '$password' found in $envFile" -ForegroundColor Yellow
                    $script:warnings += "Default password found in $envFile"
                }
            }
        }
    }
    
    # Check for exposed ports that should be internal only
    if (Test-Path "docker-compose.yaml") {
        $compose = Get-Content "docker-compose.yaml" -Raw
        
        $internalPorts = @("5432", "6379", "7687")  # Database ports that shouldn't be exposed in production
        
        foreach ($port in $internalPorts) {
            if ($compose -match "- `"$port`:$port`"") {
                Write-Host "⚠️ Database port $port is exposed (consider removing in production)" -ForegroundColor Yellow
                $script:suggestions += "Consider not exposing port $port in production"
            }
        }
    }
    
    # Check for secrets in docker-compose
    if (Test-Path "docker-compose.yaml") {
        $compose = Get-Content "docker-compose.yaml" -Raw
        
        if ($compose -match "secrets:") {
            Write-Host "✅ Docker secrets configured" -ForegroundColor Green
        } else {
            Write-Host "ℹ️ No Docker secrets found" -ForegroundColor Cyan
            $script:suggestions += "Consider using Docker secrets for sensitive data"
        }
    }
}

# Check resource limits
function Test-ResourceLimits {
    Write-Host "`n⚡ Checking resource limits..." -ForegroundColor Blue
    
    if (Test-Path "docker-compose.yaml") {
        $compose = Get-Content "docker-compose.yaml" -Raw
        
        if ($compose -match "deploy:" -and $compose -match "resources:") {
            Write-Host "✅ Resource limits configured" -ForegroundColor Green
        } else {
            Write-Host "ℹ️ No resource limits found" -ForegroundColor Cyan
            $script:suggestions += "Consider adding resource limits to prevent resource exhaustion"
        }
        
        # Check for memory limits on heavy services
        $heavyServices = @("neo4j", "solace", "postgres")
        foreach ($service in $heavyServices) {
            if ($compose -match "$service:" -and $compose -match "memory:") {
                Write-Host "✅ Memory limit set for $service" -ForegroundColor Green
            } else {
                Write-Host "ℹ️ No memory limit for $service" -ForegroundColor Cyan
                $script:suggestions += "Consider setting memory limit for $service"
            }
        }
    }
}

# Generate validation report
function Generate-ValidationReport {
    Write-Host "`n📊 Validation Report" -ForegroundColor Cyan
    Write-Host "===================" -ForegroundColor Cyan
    
    Write-Host "`n🔴 Critical Issues ($($issues.Count)):" -ForegroundColor Red
    if ($issues.Count -eq 0) {
        Write-Host "  ✅ No critical issues found!" -ForegroundColor Green
    } else {
        foreach ($issue in $issues) {
            Write-Host "  ❌ $issue" -ForegroundColor Red
        }
    }
    
    Write-Host "`n🟡 Warnings ($($warnings.Count)):" -ForegroundColor Yellow
    if ($warnings.Count -eq 0) {
        Write-Host "  ✅ No warnings!" -ForegroundColor Green
    } else {
        foreach ($warning in $warnings) {
            Write-Host "  ⚠️ $warning" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`n🔵 Suggestions ($($suggestions.Count)):" -ForegroundColor Cyan
    if ($suggestions.Count -eq 0) {
        Write-Host "  ✅ No suggestions!" -ForegroundColor Green
    } else {
        foreach ($suggestion in $suggestions) {
            Write-Host "  💡 $suggestion" -ForegroundColor Cyan
        }
    }
    
    # Overall status
    if ($issues.Count -eq 0) {
        Write-Host "`n🎉 Overall Status: CONFIGURATION IS VALID" -ForegroundColor Green
        Write-Host "✅ Your Docker configuration is ready for deployment!" -ForegroundColor Green
        
        if ($warnings.Count -eq 0 -and $suggestions.Count -eq 0) {
            Write-Host "🏆 Perfect configuration - no issues, warnings, or suggestions!" -ForegroundColor Green
        }
        
        return $true
    } else {
        Write-Host "`n❌ Overall Status: CONFIGURATION HAS ISSUES" -ForegroundColor Red
        Write-Host "Please fix the critical issues before proceeding." -ForegroundColor Red
        return $false
    }
}

# Main execution
try {
    Test-RequiredFiles
    Test-DockerComposeConfig
    Test-PortConflicts
    Test-EnvironmentVariables
    Test-NetworkConfiguration
    Test-VolumeConfiguration
    Test-DockerfileBestPractices
    Test-SecurityConfiguration
    Test-ResourceLimits
    
    $isValid = Generate-ValidationReport
    
    if ($isValid) {
        Write-Host "`n🚀 Next Steps:" -ForegroundColor Cyan
        Write-Host "1. Run: npm run docker:dev:all" -ForegroundColor White
        Write-Host "2. Run: npm run health-check" -ForegroundColor White
        Write-Host "3. Access: http://localhost" -ForegroundColor White
        exit 0
    } else {
        Write-Host "`n🔧 Fix the issues and run this validation again." -ForegroundColor Yellow
        exit 1
    }
}
catch {
    Write-Host "💥 Validation failed with error: $_" -ForegroundColor Red
    exit 1
}
