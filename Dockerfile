# ReciteRecipe - Production Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Dependencies
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Production
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from stage 1
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application files
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Create uploads directory with proper permissions
RUN mkdir -p uploads && chown -R nodejs:nodejs uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/database.sqlite
ENV JWT_SECRET=reciterecipe-secure-jwt-secret-change-in-production
ENV ADMIN_CODE=admin-secret-2024

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/recipes', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/server.js"]
