# Debug configtxgen

Write-Host "Debug: Testing configtxgen with detailed output..." -ForegroundColor Green

# Run configtxgen with debug output
docker run --rm `
  -v "C:\Users\pp\Projects\solace-typescript-HCM\fabric\config:/etc/hyperledger/configtx" `
  -v "C:\Users\pp\Projects\solace-typescript-HCM\fabric:/etc/hyperledger/fabric" `
  hyperledger/fabric-tools:latest `
  /bin/bash -c "
    export FABRIC_CFG_PATH=/etc/hyperledger/configtx && 
    export FABRIC_LOGGING_SPEC=DEBUG &&
    echo '=== Checking configtx.yaml ===' &&
    cat /etc/hyperledger/configtx/configtx.yaml | head -20 &&
    echo '=== Checking MSP directories ===' &&
    ls -la /etc/hyperledger/fabric/msp/ &&
    echo '=== Running configtxgen with debug ===' &&
    configtxgen -profile OneOrgOrdererGenesis -outputBlock /etc/hyperledger/fabric/genesis.block -channelID system-channel
  "
