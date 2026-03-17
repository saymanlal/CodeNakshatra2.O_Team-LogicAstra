#!/bin/bash

echo "🔧 Fixing Render deployment issues..."

# Commit fixes
git add .
git commit -m "Fix: LevelDB initialization and Render health checks"

# Push to trigger redeploy
git push origin main

echo "✅ Pushed fixes - Render will auto-redeploy"
echo ""
echo "Monitor at: https://dashboard.render.com"