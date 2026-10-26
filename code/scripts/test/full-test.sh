#!/bin/bash
set -e

echo "=========================================="
echo "  SCRM System - Full Test Suite"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CODE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$CODE_DIR"

REPORT_DIR="${TEST_REPORT_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/scrm-full-test.XXXXXX")}"
mkdir -p "$REPORT_DIR"
echo "Detailed logs: $REPORT_DIR"

PASS=0
FAIL=0
CHECK=0

run_test() {
  local name="$1"
  local cmd="$2"
  CHECK=$((CHECK + 1))
  local log_file="$REPORT_DIR/check-$CHECK.log"
  echo "🔍 Running: $name"
  if eval "$cmd" > "$log_file" 2>&1; then
    echo "  ✅ PASS: $name"
    PASS=$((PASS + 1))
  else
    local command_status=$?
    echo "  ❌ FAIL: $name"
    echo "  Exit: $command_status; full output: $log_file"
    tail -n 30 "$log_file"
    FAIL=$((FAIL + 1))
  fi
}

echo "🧪 Phase 0: Unit Tests (Vitest)"
echo "------------------------------------------"
run_test "Workspace unit tests (configured test:unit scope)" "pnpm test:unit"

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
echo "  Logs:     $REPORT_DIR"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
