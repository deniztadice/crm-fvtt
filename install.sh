#!/usr/bin/env bash
# ==============================================================================
# Foundry VTT v14 Custom Repository Patch — Root Installer Proxy
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"

if [[ -f "${SCRIPT_DIR}/script/install.sh" ]]; then
  exec bash "${SCRIPT_DIR}/script/install.sh" "$@"
fi

# Fallback: stream and execute script/install.sh directly from GitHub
if command -v curl >/dev/null 2>&1; then
  exec bash <(curl -sSL https://raw.githubusercontent.com/deniztadice/crm-fvtt/main/script/install.sh) "$@"
elif command -v wget >/dev/null 2>&1; then
  exec bash <(wget -q -O - https://raw.githubusercontent.com/deniztadice/crm-fvtt/main/script/install.sh) "$@"
else
  echo "Error: curl or wget is required to run the installer." >&2
  exit 1
fi
