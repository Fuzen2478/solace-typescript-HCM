# Generate Genesis Block and Channel Transaction

Write-Host "Generating Genesis Block and Channel Transaction..." -ForegroundColor Green

# First, let's check if MSP directories exist
Write-Host "Checking MSP directories..." -ForegroundColor Yellow
if (Test-Path "C:\Users\pp\Projects\solace-typescript-HCM\fabric\msp\orderer-org1") {
    Write-Host "✓ Orderer MSP found" -ForegroundColor Green
} else {
    Write-Host "✗ Orderer MSP not found" -ForegroundColor Red
}

if (Test-Path "C:\Users\pp\Projects\solace-typescript-HCM\fabric\msp\org1-admin") {
    Write-Host "✓ Org1 Admin MSP found" -ForegroundColor Green
} else {
    Write-Host "✗ Org1 Admin MSP not found" -ForegroundColor Red
}

# Run configtxgen using Docker
docker run --rm `
  -v "C:\Users\pp\Projects\solace-typescript-HCM\fabric\config:/etc/hyperledger/configtx" `
  -v "C:\Users\pp\Projects\solace-typescript-HCM\fabric:/etc/hyperledger/fabric" `
  hyperledger/fabric-tools:latest `
  /bin/bash -c "
    export FABRIC_CFG_PATH=/etc/hyperledger/configtx && 
    echo 'Generating genesis block...' &&
    configtxgen -profile OneOrgOrdererGenesis -outputBlock /etc/hyperledger/fabric/genesis.block -channelID system-channel &&
    echo 'Generating channel transaction...' &&
    configtxgen -profile OneOrgChannel -outputCreateChannelTx /etc/hyperledger/fabric/mychannel.tx -channelID mychannel &&
    echo 'Done!'
  "

Write-Host "Checking generated files..." -ForegroundColor Yellow
if (Test-Path "genesis.block") {
    Write-Host "✓ genesis.block created" -ForegroundColor Green
} else {
    Write-Host "✗ genesis.block not found" -ForegroundColor Red
}

if (Test-Path "mychannel.tx") {
    Write-Host "✓ mychannel.tx created" -ForegroundColor Green
} else {
    Write-Host "✗ mychannel.tx not found" -ForegroundColor Red
}
