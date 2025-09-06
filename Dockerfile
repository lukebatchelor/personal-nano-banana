FROM oven/bun:1 AS builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files for both frontend and backend
COPY frontend/package.json frontend/bun.lockb ./frontend/
COPY backend/package.json backend/bun.lockb ./backend/

# Install dependencies for both projects
WORKDIR /app/frontend
RUN bun install --frozen-lockfile
WORKDIR /app/backend
RUN bun install --frozen-lockfile

# Copy source files
WORKDIR /app
COPY . .

# Build frontend
WORKDIR /app/frontend
RUN bun run build

# Build backend
WORKDIR /app/backend
# NODE_ENV gets baked in at build time, so needs to be set to production
ENV NODE_ENV=production
RUN bun build --target=bun index.ts --outfile=../server.js

# Final stage
FROM oven/bun:1 as final

WORKDIR /app

# Create necessary directories for image storage
RUN mkdir -p /app/public /app/data/uploads /app/data/generated/full /app/data/generated/previews

# Copy built frontend assets and backend server
COPY --from=builder /app/frontend/dist /app/public
COPY --from=builder /app/server.js /app/server.js

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Run the server
CMD ["bun", "./server.js"]