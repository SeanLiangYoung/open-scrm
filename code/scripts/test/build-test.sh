#!/bin/bash
set -e

echo "=========================================="
echo "  SCRM System - Build Test"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CODE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$CODE_DIR"

echo "🏗️ Building all packages and services..."
pnpm build

echo ""
echo "✅ Build completed successfully!"
