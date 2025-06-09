# Health check script for services (PowerShell)

function Check-ServiceHealth {
    param(
        [string]$ServiceName,
        [int]$Port,
        [string]$Path = "/health",
        [int]$MaxAttempts = 30
    )
    
    Write-Host "Checking health of $ServiceName on port $Port..." -ForegroundColor Yellow
    
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $uri = "http://localhost:$Port$Path"
            $response = Invoke-WebRequest -Uri $uri -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ $ServiceName is healthy" -ForegroundColor Green
                return $true
            }
        }
        catch {
            # Service not ready yet
        }
        
        Write-Host "⏳ Waiting for $ServiceName... (attempt $attempt/$MaxAttempts)" -ForegroundColor Cyan
        Start-Sleep -Seconds 2
    }
    
    Write-Host "❌ $ServiceName failed to become healthy" -ForegroundColor Red
    return $false
}

function Check-TcpPort {
    param(
        [string]$ServiceName,
        [int]$Port,
        [int]$MaxAttempts = 30
    )
    
    Write-Host "Checking TCP connectivity for $ServiceName on port $Port..." -ForegroundColor Yellow
    
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $tcpClient.ConnectAsync("localhost", $Port).Wait(5000)
            if ($tcpClient.Connected) {
                $tcpClient.Close()
                Write-Host "✅ $ServiceName TCP connection successful" -ForegroundColor Green
                return $true
            }
        }
        catch {
            # Port not ready yet
        }
        
        Write-Host "⏳ Waiting for $ServiceName TCP connection... (attempt $attempt/$MaxAttempts)" -ForegroundColor Cyan
        Start-Sleep -Seconds 2
    }
    
    Write-Host "❌ $ServiceName TCP connection failed" -ForegroundColor Red
    return $false
}

Write-Host "🚀 Starting comprehensive health checks for all services..." -ForegroundColor Magenta

# Check infrastructure services (TCP connections)
Write-Host "`n📊 Checking infrastructure services..." -ForegroundColor Blue
$infraResults = @()
$infraResults += Check-TcpPort "Redis" 6379
$infraResults += Check-ServiceHealth "Neo4j" 7474 "/browser/"
$infraResults += Check-TcpPort "PostgreSQL" 5432
$infraResults += Check-TcpPort "OpenLDAP" 389
$infraResults += Check-ServiceHealth "Solace PubSub+" 8080 "/"

# Check application services
Write-Host "`n🏗️ Checking application services..." -ForegroundColor Blue
$appResults = @()
$appResults += Check-ServiceHealth "API Gateway" 3001
$appResults += Check-ServiceHealth "HR Resource" 3002
$appResults += Check-ServiceHealth "Matching Engine" 3003
$appResults += Check-ServiceHealth "Verification" 3004
$appResults += Check-ServiceHealth "Edge Agent" 3005

# Check management services
Write-Host "`n🛠️ Checking management services..." -ForegroundColor Blue
$mgmtResults = @()
$mgmtResults += Check-ServiceHealth "Nginx" 80 "/health"
$mgmtResults += Check-ServiceHealth "Portainer" 9001 "/"
$mgmtResults += Check-ServiceHealth "Redis Commander" 8082 "/"
$mgmtResults += Check-ServiceHealth "LDAP Admin" 8083 "/"

# Summary
$allResults = $infraResults + $appResults + $mgmtResults
$successCount = ($allResults | Where-Object { $_ -eq $true }).Count
$totalCount = $allResults.Count

Write-Host "`n📋 Health Check Summary" -ForegroundColor Magenta
Write-Host "=====================" -ForegroundColor Magenta
Write-Host "Total Services: $totalCount" -ForegroundColor White
Write-Host "Healthy Services: $successCount" -ForegroundColor Green
Write-Host "Failed Services: $($totalCount - $successCount)" -ForegroundColor Red

if ($successCount -eq $totalCount) {
    Write-Host "`n🎉 All services are running successfully!" -ForegroundColor Green
    Write-Host "`n🌐 Access URLs:" -ForegroundColor Cyan
    Write-Host "   Main Dashboard: http://localhost" -ForegroundColor White
    Write-Host "   API Gateway: http://localhost/api" -ForegroundColor White
    Write-Host "   Solace Manager: http://localhost/solace" -ForegroundColor White
    Write-Host "   Neo4j Browser: http://localhost/neo4j" -ForegroundColor White
    Write-Host "   LDAP Admin: http://localhost/ldap-admin" -ForegroundColor White
    Write-Host "   Redis Commander: http://localhost/redis" -ForegroundColor White
    Write-Host "   Portainer: http://localhost/portainer" -ForegroundColor White
    exit 0
} else {
    Write-Host "`n⚠️ Some services are not healthy. Check the logs for details:" -ForegroundColor Yellow
    Write-Host "   docker-compose logs [service-name]" -ForegroundColor White
    Write-Host "`n🔧 Troubleshooting commands:" -ForegroundColor Cyan
    Write-Host "   npm run docker:logs" -ForegroundColor White
    Write-Host "   docker-compose ps" -ForegroundColor White
    Write-Host "   docker-compose restart [service-name]" -ForegroundColor White
    exit 1
}
