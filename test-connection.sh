#!/bin/bash
# Simple test script to check if the Godot debug port is accessible

HOST="${GODOT_DEBUG_HOST:-127.0.0.1}"
PORT="${GODOT_DEBUG_PORT:-6006}"

echo "Testing connection to Godot debug port at $HOST:$PORT..."

# Check if netcat is available
if command -v nc &> /dev/null; then
    # Try to connect with a timeout
    if timeout 2 nc -zv "$HOST" "$PORT" 2>&1; then
        echo "✓ Connection successful! Godot debug port is accessible."
        exit 0
    else
        echo "✗ Connection failed. Make sure:"
        echo "  1. Godot is running"
        echo "  2. Debugging is enabled"
        echo "  3. The correct port is being used (6006 for editor, 6007 for game)"
        exit 1
    fi
else
    echo "Warning: netcat (nc) not found. Cannot test connection."
    echo "Please install netcat or manually verify the port is open."
    exit 2
fi
