FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies in the container
# Using npm ci for reproducible, clean installs
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Make the entry point executable
RUN chmod +x src/index.js

# Set environment variables with sensible defaults
ENV GODOT_DEBUG_HOST=host.docker.internal
ENV GODOT_DEBUG_PORT=6006
ENV GODOT_LSP_HOST=host.docker.internal
ENV GODOT_LSP_PORT=6005

# Run the MCP server
CMD ["node", "src/index.js"]
