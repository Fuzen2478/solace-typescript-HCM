FROM node:18-alpine

# Install pnpm, development tools, and curl for health checks
RUN npm install -g pnpm nodemon ts-node && \
    apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build || echo "Build failed, continuing with dev mode"

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

CMD ["sh", "-c", "pnpm dev:hr || (sleep 10 && nodemon --exec ts-node src/services/hr-resource/index.ts)"]
