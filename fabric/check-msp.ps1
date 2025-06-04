# MSP Structure Check Script

Write-Host "Checking MSP directory structure..." -ForegroundColor Green

$mspDirs = @("orderer-org1", "org1-admin", "peer0-org1")

foreach ($dir in $mspDirs) {
    Write-Host "`n=== MSP: $dir ===" -ForegroundColor Yellow
    $mspPath = "C:\Users\pp\Projects\solace-typescript-HCM\fabric\msp\$dir"
    
    if (Test-Path $mspPath) {
        Write-Host "✓ Directory exists" -ForegroundColor Green
        
        # Check subdirectories
        $requiredDirs = @("cacerts", "keystore", "signcerts", "admincerts")
        foreach ($subdir in $requiredDirs) {
            $subdirPath = Join-Path $mspPath $subdir
            if (Test-Path $subdirPath) {
                $files = Get-ChildItem -Path $subdirPath -File
                Write-Host "  ✓ $subdir ($($files.Count) files)" -ForegroundColor Green
            } else {
                Write-Host "  ✗ $subdir missing" -ForegroundColor Red
            }
        }
        
        # Check config.yaml
        if (Test-Path (Join-Path $mspPath "config.yaml")) {
            Write-Host "  ✓ config.yaml exists" -ForegroundColor Green
        } else {
            Write-Host "  ✗ config.yaml missing" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ Directory not found" -ForegroundColor Red
    }
}

Write-Host "`nMSP structure check complete!" -ForegroundColor Green
