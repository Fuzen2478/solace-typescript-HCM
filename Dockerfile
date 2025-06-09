# Base stage
FROM node:18-alpine AS base
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm install -g pnpm typescript ts-node
RUN pnpm install
COPY . .

# HR Resource Service
FROM base AS hr-resource
EXPOSE 3001 3011
CMD ["npx", "ts-node", "--transpile-only", "src/services/hr-resource/index.ts"]

# Matching Engine Service  
FROM base AS matching-engine
EXPOSE 3002 3012
CMD ["npx", "ts-node", "--transpile-only", "src/services/matching-engine/index.ts"]

# API Gateway Service
FROM base AS api-gateway
EXPOSE 3000 3010
CMD ["npx", "ts-node", "--transpile-only", "src/services/api-gateway/index.ts"]

# Verification Service
FROM base AS verification
EXPOSE 3005
CMD ["npx", "ts-node", "--transpile-only", "src/services/verification/index.ts"]

# Edge Agent Service
FROM base AS edge-agent
EXPOSE 3004 3008
CMD ["npx", "ts-node", "--transpile-only", "src/services/edge-agent/index.ts"]