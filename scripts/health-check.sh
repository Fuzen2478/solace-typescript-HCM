#!/bin/bash

# Health check script for services
check_service_health() {
    local service_name=$1
    local port=$2
    local path=${3:-"/health"}
    local max_attempts=${4:-30}
    local attempt=1

    echo "🔍 Checking health of $service_name on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:$port$path" > /dev/null 2>&1; then
            echo "✅ $service_name is healthy"
            return 0
        else
            echo "⏳ Waiting for $service_name... (attempt $attempt/$max_attempts)"
            sleep 2
            ((attempt++))
        fi
    done
    
    echo "❌ $service_name failed to become healthy"
    return 1
}

check_tcp_port() {
    local service_name=$1
    local port=$2
    local max_attempts=${3:-30}
    local attempt=1

    echo "🔍 Checking TCP connectivity for $service_name on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port > /dev/null 2>&1; then
            echo "✅ $service_name TCP connection successful"
            return 0
        else
            echo "⏳ Waiting for $service_name TCP connection... (attempt $attempt/$max_attempts)"
            sleep 2
            ((attempt++))
        fi
    done
    
    echo "❌ $service_name TCP connection failed"
    return 1
}

echo "🚀 Starting comprehensive health checks for all services..."

# Check infrastructure services
echo ""
echo "📊 Checking infrastructure services..."
infra_success=0
infra_total=0

# Redis
((infra_total++))
if check_tcp_port "Redis" 6379; then ((infra_success++)); fi

# Neo4j
((infra_total++))
if check_service_health "Neo4j" 7474 "/browser/"; then ((infra_success++)); fi

# PostgreSQL
((infra_total++))
if check_tcp_port "PostgreSQL" 5432; then ((infra_success++)); fi

# OpenLDAP
((infra_total++))
if check_tcp_port "OpenLDAP" 389; then ((infra_success++)); fi

# Solace PubSub+
((infra_total++))
if check_service_health "Solace PubSub+" 8080 "/"; then ((infra_success++)); fi

# Check application services
echo ""
echo "🏗️ Checking application services..."
app_success=0
app_total=0

services=("API Gateway:3001" "HR Resource:3002" "Matching Engine:3003" "Verification:3004" "Edge Agent:3005")

for service in "${services[@]}"; do
    IFS=':' read -r name port <<< "$service"
    ((app_total++))
    if check_service_health "$name" "$port"; then ((app_success++)); fi
done

# Check management services
echo ""
echo "🛠️ Checking management services..."
mgmt_success=0
mgmt_total=0

mgmt_services=("Nginx:80:/health" "Portainer:9001:/" "Redis Commander:8082:/" "LDAP Admin:8083:/")

for service in "${mgmt_services[@]}"; do
    IFS=':' read -r name port path <<< "$service"
    ((mgmt_total++))
    if check_service_health "$name" "$port" "$path"; then ((mgmt_success++)); fi
done

# Calculate totals
total_success=$((infra_success + app_success + mgmt_success))
total_services=$((infra_total + app_total + mgmt_total))

echo ""
echo "📋 Health Check Summary"
echo "====================="
echo "Infrastructure: $infra_success/$infra_total"
echo "Applications: $app_success/$app_total"
echo "Management: $mgmt_success/$mgmt_total"
echo "Total: $total_success/$total_services"

if [ $total_success -eq $total_services ]; then
    echo ""
    echo "🎉 All services are running successfully!"
    echo ""
    echo "🌐 Access URLs:"
    echo "   Main Dashboard: http://localhost"
    echo "   API Gateway: http://localhost/api"
    echo "   Solace Manager: http://localhost/solace"
    echo "   Neo4j Browser: http://localhost/neo4j"
    echo "   LDAP Admin: http://localhost/ldap-admin"
    echo "   Redis Commander: http://localhost/redis"
    echo "   Portainer: http://localhost/portainer"
    exit 0
else
    echo ""
    echo "⚠️ Some services are not healthy. Check the logs for details:"
    echo "   docker-compose logs [service-name]"
    echo ""
    echo "🔧 Troubleshooting commands:"
    echo "   npm run docker:logs"
    echo "   docker-compose ps"
    echo "   docker-compose restart [service-name]"
    exit 1
fi
