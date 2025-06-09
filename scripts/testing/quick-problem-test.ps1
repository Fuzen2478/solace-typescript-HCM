# Quick Problem Isolation Test
Write-Host "=== Quick Problem Isolation Test ===" -ForegroundColor Yellow

# Test 1: Simple analytics
Write-Host "`n1. Testing Analytics (Direct):" -ForegroundColor Cyan
try {
    $analytics = Invoke-RestMethod -Uri "http://localhost:3001/analytics/skills" -TimeoutSec 5
    Write-Host "✓ Analytics works! Skills count: $($analytics.Count)" -ForegroundColor Green
} catch {
    Write-Host "✗ Analytics failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Simple complex task
Write-Host "`n2. Testing Complex Task (Step by step):" -ForegroundColor Cyan

# First try with empty skills array
$taskWithEmptySkills = @{
    title = "Task with Empty Skills"
    description = "Test description"
    requiredSkills = @()
    priority = "medium"
    estimatedHours = 8
    remoteAllowed = $true
    createdBy = "test-user"
}

try {
    $result1 = Invoke-RestMethod -Uri "http://localhost:3002/tasks" -Method Post -Body ($taskWithEmptySkills | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ Empty skills task works: $($result1.task.title)" -ForegroundColor Green
} catch {
    Write-Host "✗ Empty skills task failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Now try with one simple skill
$taskWithOneSkill = @{
    title = "Task with One Skill"
    description = "Test description"
    requiredSkills = @(
        @{name="JavaScript"; level="intermediate"; mandatory=$true; weight=0.8}
    )
    priority = "medium"
    estimatedHours = 8
    remoteAllowed = $true
    createdBy = "test-user"
}

try {
    $result2 = Invoke-RestMethod -Uri "http://localhost:3002/tasks" -Method Post -Body ($taskWithOneSkill | ConvertTo-Json -Depth 5) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✓ One skill task works: $($result2.task.title)" -ForegroundColor Green
    Write-Host "  Matches found: $($result2.initialMatches.Count)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ One skill task failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Quick Test Complete ===" -ForegroundColor Yellow