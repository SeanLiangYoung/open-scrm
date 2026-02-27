#!/bin/bash
set -e

echo "=========================================="
echo "  SCRM System - Type Check"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CODE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$CODE_DIR"

echo "📦 Building shared packages first..."
pnpm --filter @scrm/shared-types build
pnpm --filter @scrm/shared-constants build
pnpm --filter @scrm/shared-utils build
pnpm --filter @scrm/server-common build

echo ""
echo "🔧 Running type check..."
pnpm type-check

echo ""
echo "✅ Type check completed successfully!"
