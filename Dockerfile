FROM node:20-slim

WORKDIR /app

# Copy package files and pre-installed dependencies
# This avoids npm installation issues in Docker build
COPY package.json package-lock.json ./
COPY node_modules/ ./node_modules/

# Copy source code
COPY src/ ./src/

# Make the entry point executable
RUN chmod +x src/index.js

# Set environment variables
ENV GODOT_DEBUG_HOST=host.docker.internal
ENV GODOT_DEBUG_PORT=6006

# Run the MCP server
CMD ["node", "src/index.js"]
