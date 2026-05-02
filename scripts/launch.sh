#!/bin/bash
# Claude History Viewer Launcher
# This script starts the dev server and opens the browser

cd "$(dirname "$0")/.."

echo "Starting Claude History Viewer..."

# Start the dev server in the background
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 3

# Open the default browser
open http://localhost:3000

echo "Claude History Viewer is running at http://localhost:3000"
echo "Press Ctrl+C to stop the server"

# Wait for the server process
wait $SERVER_PID
