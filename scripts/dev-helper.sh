#!/bin/bash

# Local development script for RSS feed system
echo "🚀 RSS Feed Development Helper"
echo "=============================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

# Update feeds
echo "🔄 Updating RSS feeds..."
npm run update-feeds

if [ $? -eq 0 ]; then
    echo "✅ RSS feeds updated successfully!"
    echo ""
    echo "📁 Generated files:"
    ls -la data/feeds/
    echo ""
    echo "🌐 To test locally, run:"
    echo "   python3 -m http.server 8080"
    echo "   Then open: http://localhost:8080"
else
    echo "❌ Failed to update RSS feeds"
    exit 1
fi
