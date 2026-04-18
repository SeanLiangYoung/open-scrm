#!/bin/bash
set -e

echo "=========================================="
echo "  SCRM System - Full Test Suite"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CODE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$CODE_DIR"

PASS=0
FAIL=0
WARN=0

run_test() {
  local name="$1"
  local cmd="$2"
  echo "🔍 Running: $name"
  if eval "$cmd" > /dev/null 2>&1; then
    echo "  ✅ PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $name"
    FAIL=$((FAIL + 1))
  fi
}

echo "🧪 Phase 0: Unit Tests (Vitest)"
echo "------------------------------------------"
run_test "Vitest (shared-utils, gateway, auth, integration)" "pnpm test:unit"

echo ""
echo "📦 Phase 1: Shared Packages Build"
echo "------------------------------------------"
run_test "shared-types build" "pnpm --filter @scrm/shared-types build"
run_test "shared-constants build" "pnpm --filter @scrm/shared-constants build"
run_test "shared-utils build" "pnpm --filter @scrm/shared-utils build"
run_test "server-common build" "pnpm --filter @scrm/server-common build"

echo ""
echo "🔧 Phase 2: Type Check"
echo "------------------------------------------"
run_test "Type check all packages" "pnpm type-check"

echo ""
echo "📝 Phase 3: Lint"
echo "------------------------------------------"
run_test "ESLint all packages" "pnpm lint"

echo ""
echo "🏗️ Phase 4: Service Build"
echo "------------------------------------------"
run_test "Build all services" "pnpm build"

echo ""
echo "=========================================="
echo "  Test Results"
echo "=========================================="
echo "  ✅ Passed: $PASS"
echo "  ❌ Failed: $FAIL"
echo "  Total:    $((PASS + FAIL))"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
