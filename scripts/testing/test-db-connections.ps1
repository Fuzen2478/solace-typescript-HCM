# Test Neo4j and Redis connections
Write-Host "=== Testing Database Connections ===" -ForegroundColor Yellow

# Test Neo4j
Write-Host "`n1. Testing Neo4j Connection:" -ForegroundColor Cyan
try {
    $neo4jResponse = Invoke-WebRequest -Uri "http://localhost:7474" -TimeoutSec 5
    Write-Host "✓ Neo4j Web Interface: $($neo4jResponse.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "✗ Neo4j Web Interface Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Redis
Write-Host "`n2. Testing Redis Connection:" -ForegroundColor Cyan
try {
    $redisTest = docker compose exec redis redis-cli ping
    Write-Host "✓ Redis Response: $redisTest" -ForegroundColor Green
} catch {
    Write-Host "✗ Redis Test Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test if services can connect to databases
Write-Host "`n3. Testing Service Database Connections:" -ForegroundColor Cyan
Write-Host "HR Resource -> Neo4j:" -ForegroundColor Yellow
try {
    docker compose exec hr-resource sh -c "nc -z neo4j 7687"
    Write-Host "✓ HR can reach Neo4j" -ForegroundColor Green
} catch {
    Write-Host "✗ HR cannot reach Neo4j" -ForegroundColor Red
}

Write-Host "Matching Engine -> Neo4j:" -ForegroundColor Yellow
try {
    docker compose exec matching-engine sh -c "nc -z neo4j 7687"
    Write-Host "✓ Matching can reach Neo4j" -ForegroundColor Green
} catch {
    Write-Host "✗ Matching cannot reach Neo4j" -ForegroundColor Red
}

Write-Host "HR Resource -> Redis:" -ForegroundColor Yellow
try {
    docker compose exec hr-resource sh -c "nc -z redis 6379"
    Write-Host "✓ HR can reach Redis" -ForegroundColor Green
} catch {
    Write-Host "✗ HR cannot reach Redis" -ForegroundColor Red
}

Write-Host "`n=== Database Connection Test Complete ===" -ForegroundColor Yellow