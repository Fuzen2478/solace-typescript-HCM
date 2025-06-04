# Setup Channel Script

Write-Host "Setting up Fabric Channel..." -ForegroundColor Green

# Check if fabric binaries exist
if (-not (Test-Path "C:\fabric\bin\peer.exe")) {
    Write-Host "Error: Fabric binaries not found at C:\fabric\bin" -ForegroundColor Red
    Write-Host "Please download and extract Hyperledger Fabric binaries first" -ForegroundColor Yellow
    exit 1
}

# Add fabric bin to PATH if not already there
$env:PATH = "C:\fabric\bin;$env:PATH"

# Set environment variables
$env:CORE_PEER_TLS_ENABLED = "false"
$env:CORE_PEER_LOCALMSPID = "Org1MSP"
$env:CORE_PEER_MSPCONFIGPATH = "C:\Users\pp\Projects\solace-typescript-HCM\fabric\msp\org1-admin"
$env:CORE_PEER_ADDRESS = "localhost:7051"

Write-Host "Waiting for containers to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Create channel
Write-Host "Creating channel..." -ForegroundColor Yellow
peer channel create `
    -o localhost:7050 `
    -c mychannel `
    -f C:\Users\pp\Projects\solace-typescript-HCM\fabric\mychannel.tx `
    --outputBlock C:\Users\pp\Projects\solace-typescript-HCM\fabric\mychannel.block

if ($LASTEXITCODE -eq 0) {
    Write-Host "Channel created successfully!" -ForegroundColor Green
} else {
    Write-Host "Failed to create channel" -ForegroundColor Red
    exit 1
}

# Join channel
Write-Host "Joining channel..." -ForegroundColor Yellow
peer channel join -b C:\Users\pp\Projects\solace-typescript-HCM\fabric\mychannel.block

if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully joined channel!" -ForegroundColor Green
} else {
    Write-Host "Failed to join channel" -ForegroundColor Red
    exit 1
}

# List channels
Write-Host "Listing channels..." -ForegroundColor Yellow
peer channel list

Write-Host "Channel setup complete!" -ForegroundColor Green
