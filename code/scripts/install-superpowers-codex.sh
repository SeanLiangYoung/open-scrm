#!/usr/bin/env bash
# Install Superpowers for Codex - from https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.codex/INSTALL.md

set -e

CODEX_DIR="${HOME}/.codex"
SUPERPOWERS_DIR="${CODEX_DIR}/superpowers"
AGENTS_MD="${CODEX_DIR}/AGENTS.md"

echo "==> Creating superpowers directory..."
mkdir -p "${SUPERPOWERS_DIR}"
cd "${SUPERPOWERS_DIR}"

if [ -d .git ]; then
  echo "==> Superpowers repo already cloned, pulling latest..."
  git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || true
else
  echo "==> Cloning superpowers repository..."
  git clone https://github.com/obra/superpowers.git .
fi

echo "==> Creating personal skills directory..."
mkdir -p "${CODEX_DIR}/skills"

echo "==> Updating ~/.codex/AGENTS.md..."
SUPERPOWERS_SECTION='## Superpowers System

You have superpowers. Superpowers teach you new skills and capabilities. RIGHT NOW run: `~/.codex/superpowers/.codex/superpowers-codex bootstrap` and follow the instructions it returns.
'

if [ -f "${AGENTS_MD}" ]; then
  if grep -q "Superpowers System" "${AGENTS_MD}"; then
    echo "    (Superpowers section already present in AGENTS.md)"
  else
    echo "${SUPERPOWERS_SECTION}" >> "${AGENTS_MD}"
    echo "    Appended Superpowers section to existing AGENTS.md"
  fi
else
  mkdir -p "${CODEX_DIR}"
  echo "${SUPERPOWERS_SECTION}" > "${AGENTS_MD}"
  echo "    Created new AGENTS.md with Superpowers section"
fi

echo ""
echo "==> Verification: running bootstrap..."
"${SUPERPOWERS_DIR}/.codex/superpowers-codex" bootstrap 2>/dev/null || {
  echo "    (bootstrap script path may vary; run manually: ${SUPERPOWERS_DIR}/.codex/superpowers-codex bootstrap)"
}

echo ""
echo "Done. Superpowers for Codex is installed."
