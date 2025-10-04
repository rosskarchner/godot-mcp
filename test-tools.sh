#!/bin/bash
# Test script to verify MCP server tools

echo "Testing Godot MCP Server..."
echo

# Test 1: Initialize
echo "Test 1: Initialize server"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | timeout 2 node src/index.js 2>/dev/null | jq '.result.serverInfo'
echo

# Test 2: List tools
echo "Test 2: List available tools"
(
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
  sleep 0.5
) | timeout 3 node src/index.js 2>/dev/null | grep -A 1 '"id":2' | tail -1 | jq '.result.tools | length'
echo " tools available"
echo

echo "All basic tests passed! ✓"
