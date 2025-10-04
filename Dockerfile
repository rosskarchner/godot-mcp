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

# Add Docker MCP metadata label for self-contained operation
LABEL io.docker.server.metadata='{\
  "name": "godot-mcp-server",\
  "description": "MCP server for Godot Engine debugging (DAP) and code intelligence (LSP)",\
  "command": ["node", "src/index.js"],\
  "env": [\
    {"name": "GODOT_DEBUG_HOST", "value": "{{godot-mcp-server.debug_host}}"},\
    {"name": "GODOT_DEBUG_PORT", "value": "{{godot-mcp-server.debug_port}}"},\
    {"name": "GODOT_LSP_HOST", "value": "{{godot-mcp-server.lsp_host}}"},\
    {"name": "GODOT_LSP_PORT", "value": "{{godot-mcp-server.lsp_port}}"}\
  ],\
  "config": [\
    {\
      "name": "godot-mcp-server",\
      "type": "object",\
      "properties": {\
        "debug_host": {"type": "string", "default": "host.docker.internal"},\
        "debug_port": {"type": "string", "default": "6006"},\
        "lsp_host": {"type": "string", "default": "host.docker.internal"},\
        "lsp_port": {"type": "string", "default": "6005"}\
      }\
    }\
  ]\
}'

# Run the MCP server
CMD ["node", "src/index.js"]
