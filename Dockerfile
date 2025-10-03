FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY src/ ./src/

# Make the entry point executable
RUN chmod +x src/index.js

# Set environment variables
ENV GODOT_DEBUG_HOST=host.docker.internal
ENV GODOT_DEBUG_PORT=6006

# Run the MCP server
CMD ["node", "src/index.js"]
