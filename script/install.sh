#!/usr/bin/env bash
# ==============================================================================
# Foundry VTT v14 Custom Repository Patch Installer
# ==============================================================================
# Installs custom-repo.mjs and Handlebars templates into Foundry VTT v14,
# and hooks the script into templates/views/layouts/setup.hbs.
#
# Usage:
#   ./install.sh [OPTIONS] [PATH_TO_FOUNDRY]
#
# Options:
#   -p, --path PATH     Specify the Foundry VTT directory explicitly
#   -u, --uninstall     Remove the patch and restore original setup.hbs
#   -h, --help          Show this help message
# ==============================================================================

set -euo pipefail

# ANSI Color Codes
CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_GREEN="\033[32m"
CLR_BLUE="\033[34m"
CLR_YELLOW="\033[33m"
CLR_RED="\033[31m"
CLR_CYAN="\033[36m"

print_header() {
  echo -e "${CLR_BLUE}${CLR_BOLD}"
  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║         Foundry VTT v14 - Custom Repository Patch Installer          ║"
  echo "╚══════════════════════════════════════════════════════════════════════╝"
  echo -e "${CLR_RESET}"
}

print_info() {
  echo -e "${CLR_CYAN}[INFO]${CLR_RESET} $1"
}

print_success() {
  echo -e "${CLR_GREEN}${CLR_BOLD}[SUCCESS]${CLR_RESET} $1"
}

print_warn() {
  echo -e "${CLR_YELLOW}[WARN]${CLR_RESET} $1"
}

print_error() {
  echo -e "${CLR_RED}${CLR_BOLD}[ERROR]${CLR_RESET} $1" >&2
}

show_help() {
  cat << EOF
Foundry VTT v14 Custom Repository Patch Installer

Usage:
  ./install.sh [OPTIONS] [PATH_TO_FOUNDRY]

Options:
  -p, --path PATH   Specify the Foundry VTT directory explicitly
  -u, --uninstall   Uninstall the patch and revert changes
  -h, --help        Show this help screen

Examples:
  ./install.sh
  ./install.sh /home/user/foundryvtt
  ./install.sh /home/user/foundryvtt/app
  ./install.sh /home/user/foundryvtt/resources/app
  ./install.sh --path /opt/foundryvtt
  ./install.sh --uninstall
  ./install.sh --uninstall /home/user/foundryvtt
EOF
}

# Resolve script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"

FOUNDRY_INPUT_DIR=""
UNINSTALL_MODE=false

# Parse arguments flexibly
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      show_help
      exit 0
      ;;
    -u|--uninstall)
      UNINSTALL_MODE=true
      shift
      ;;
    -p|--path)
      if [[ -z "${2:-}" ]]; then
        print_error "Option $1 requires an argument."
        exit 1
      fi
      FOUNDRY_INPUT_DIR="$2"
      shift 2
      ;;
    -*)
      print_error "Unknown option: $1"
      show_help
      exit 1
      ;;
    *)
      if [[ -z "$FOUNDRY_INPUT_DIR" ]]; then
        FOUNDRY_INPUT_DIR="$1"
        shift
      else
        print_error "Unexpected argument: $1"
        show_help
        exit 1
      fi
      ;;
  esac
done

# Normalize any directory candidate to the Foundry app directory
# (where templates/views/layouts/setup.hbs and public/ are located)
normalize_foundry_dir() {
  local dir="$1"
  [[ -z "$dir" ]] && return 1

  if [[ ! -d "$dir" ]]; then
    return 1
  fi

  local abs_dir
  abs_dir="$(cd "$dir" 2>/dev/null && pwd)" || return 1

  # 1. Direct app directory
  if [[ -f "${abs_dir}/templates/views/layouts/setup.hbs" || -f "${abs_dir}/templates/views/layouts/setup.hbs.bak" ]]; then
    echo "$abs_dir"
    return 0
  fi

  # 2. Foundry installation root containing "app/"
  if [[ -f "${abs_dir}/app/templates/views/layouts/setup.hbs" || -f "${abs_dir}/app/templates/views/layouts/setup.hbs.bak" ]]; then
    echo "${abs_dir}/app"
    return 0
  fi

  # 3. Electron / standalone bundle containing "resources/app/"
  if [[ -f "${abs_dir}/resources/app/templates/views/layouts/setup.hbs" || -f "${abs_dir}/resources/app/templates/views/layouts/setup.hbs.bak" ]]; then
    echo "${abs_dir}/resources/app"
    return 0
  fi

  return 1
}

# Auto-detect Foundry app directory if not provided
detect_foundry_dir() {
  local candidates=(
    "$(pwd)"
    "$(cd "$(pwd)/.." 2>/dev/null && pwd || true)"
    "${SCRIPT_DIR}"
    "$(cd "${SCRIPT_DIR}/.." 2>/dev/null && pwd || true)"
    "$(cd "${SCRIPT_DIR}/../.." 2>/dev/null && pwd || true)"
    "/home/${USER:-}/foundryvtt"
    "/home/${USER:-}/foundryvtt/app"
    "/home/${USER:-}/foundryvtt/resources/app"
    "/home/${USER:-}/foundry"
    "/home/${USER:-}/app"
    "/opt/foundryvtt"
    "/opt/foundryvtt/resources/app"
    "/opt/foundry"
    "/opt/foundry/resources/app"
  )

  for cand in "${candidates[@]}"; do
    if [[ -n "$cand" && -d "$cand" ]]; then
      local resolved
      if resolved="$(normalize_foundry_dir "$cand" 2>/dev/null)"; then
        echo "$resolved"
        return 0
      fi
    fi
  done

  return 1
}

# Prompt user interactively for Foundry directory if auto-detection fails
prompt_for_foundry_dir() {
  local prompt_msg="Please enter path to Foundry VTT: "
  local input_path=""

  # Determine if an interactive TTY is available (even when piped via curl | bash)
  local tty_input=""
  if [[ -t 0 ]]; then
    tty_input="/dev/stdin"
  elif [[ -r /dev/tty ]]; then
    tty_input="/dev/tty"
  fi

  if [[ -z "$tty_input" ]]; then
    print_error "Could not automatically locate Foundry VTT installation directory."
    echo "Non-interactive terminal detected. Please specify path explicitly:"
    echo "  ./install.sh -p /path/to/foundry"
    exit 1
  fi

  echo ""
  print_warn "Could not automatically locate Foundry VTT directory."
  echo "Common locations: /opt/foundryvtt, /home/${USER:-user}/foundryvtt, /home/${USER:-user}/foundry/resources/app"
  echo ""

  while true; do
    echo -ne "${CLR_YELLOW}${CLR_BOLD}${prompt_msg}${CLR_RESET}"
    if ! read -r input_path < "$tty_input"; then
      echo ""
      print_error "Input aborted."
      exit 1
    fi

    # Trim whitespace and quotes
    input_path="$(echo "$input_path" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^["'"'"']//' -e 's/["'"'"']$//')"

    if [[ -z "$input_path" ]]; then
      print_warn "Path cannot be empty. Please enter a valid path or press Ctrl+C to cancel."
      continue
    fi

    # Expand tilde ~
    input_path="${input_path/#\~/$HOME}"

    local resolved
    if resolved="$(normalize_foundry_dir "$input_path" 2>/dev/null)"; then
      FOUNDRY_APP_DIR="$resolved"
      print_success "Foundry app directory resolved: ${CLR_BOLD}${FOUNDRY_APP_DIR}${CLR_RESET}"
      return 0
    else
      echo ""
      print_error "Could not find a valid Foundry VTT installation at: ${input_path}"
      echo "Expected templates/views/layouts/setup.hbs inside the directory, or in app/ or resources/app/."
      echo "Please try again or press Ctrl+C to exit."
      echo ""
    fi
  done
}

print_header

FOUNDRY_APP_DIR=""
if [[ -z "$FOUNDRY_INPUT_DIR" ]]; then
  print_info "Searching for Foundry VTT directory..."
  if FOUNDRY_APP_DIR="$(detect_foundry_dir)"; then
    print_info "Foundry app directory detected: ${CLR_BOLD}${FOUNDRY_APP_DIR}${CLR_RESET}"
  else
    prompt_for_foundry_dir
  fi
else
  if FOUNDRY_APP_DIR="$(normalize_foundry_dir "$FOUNDRY_INPUT_DIR")"; then
    print_info "Foundry app directory resolved: ${CLR_BOLD}${FOUNDRY_APP_DIR}${CLR_RESET}"
  else
    print_error "Could not find valid Foundry VTT installation at: ${FOUNDRY_INPUT_DIR}"
    print_error "Expected templates/views/layouts/setup.hbs in $FOUNDRY_INPUT_DIR, $FOUNDRY_INPUT_DIR/app, or $FOUNDRY_INPUT_DIR/resources/app."
    exit 1
  fi
fi

# Verify directory structure
SETUP_HBS="${FOUNDRY_APP_DIR}/templates/views/layouts/setup.hbs"
PUBLIC_DIR="${FOUNDRY_APP_DIR}/public"
PUBLIC_SCRIPTS_DIR="${PUBLIC_DIR}/scripts"
PUBLIC_TEMPLATES_DIR="${PUBLIC_DIR}/templates"
BACKUP_SETUP_HBS="${SETUP_HBS}.bak"
SCRIPT_TAG='<script type="module" src="/scripts/custom-repo.mjs"></script>'

# ------------------------------------------------------------------------------
# UNINSTALLATION
# ------------------------------------------------------------------------------
if [[ "$UNINSTALL_MODE" = true ]]; then
  print_info "Uninstalling Custom Repository Patch..."

  # Revert setup.hbs
  if [[ -f "$BACKUP_SETUP_HBS" ]]; then
    print_info "Restoring ${SETUP_HBS} from backup..."
    cp "$BACKUP_SETUP_HBS" "$SETUP_HBS"
    rm -f "$BACKUP_SETUP_HBS"
    print_success "Restored ${SETUP_HBS} from backup."
  elif grep -q "custom-repo.mjs" "$SETUP_HBS" 2>/dev/null; then
    print_info "Removing script tag from ${SETUP_HBS}..."
    awk '!/custom-repo\.mjs/' "$SETUP_HBS" > "${SETUP_HBS}.tmp" && mv "${SETUP_HBS}.tmp" "$SETUP_HBS"
    print_success "Removed patch tag from ${SETUP_HBS}."
  else
    print_info "No patch tag found in ${SETUP_HBS}."
  fi

  # Remove patch files from all potential installation directories
  files_to_remove=(
    "${PUBLIC_SCRIPTS_DIR}/custom-repo.mjs"
    "${PUBLIC_DIR}/custom-package-card.hbs"
    "${PUBLIC_DIR}/custom-repo-manager.hbs"
    "${PUBLIC_TEMPLATES_DIR}/custom-package-card.hbs"
    "${PUBLIC_TEMPLATES_DIR}/custom-repo-manager.hbs"
  )

  removed_count=0
  for file in "${files_to_remove[@]}"; do
    if [[ -f "$file" ]]; then
      rm -f "$file"
      print_info "Removed $(basename "$file") (from $(dirname "$file"))"
      removed_count=$((removed_count + 1))
    fi
  done

  # Clean up public/templates directory if left empty
  if [[ -d "$PUBLIC_TEMPLATES_DIR" ]]; then
    rmdir "$PUBLIC_TEMPLATES_DIR" 2>/dev/null || true
  fi

  print_success "Custom Repository Patch uninstalled successfully (${removed_count} files removed)."
  exit 0
fi

# ------------------------------------------------------------------------------
# INSTALLATION
# ------------------------------------------------------------------------------
print_info "Target Directory: ${CLR_BOLD}${FOUNDRY_APP_DIR}${CLR_RESET}"

# Locate source files
find_source_file() {
  local filename="$1"
  local candidates=(
    "${SCRIPT_DIR}/${filename}"
    "${SCRIPT_DIR}/public/${filename}"
    "${SCRIPT_DIR}/scripts/${filename}"
    "${SCRIPT_DIR}/templates/${filename}"
    "${FOUNDRY_APP_DIR}/public/${filename}"
    "${FOUNDRY_APP_DIR}/public/scripts/${filename}"
    "${FOUNDRY_APP_DIR}/public/templates/${filename}"
  )

  for cand in "${candidates[@]}"; do
    if [[ -f "$cand" ]]; then
      echo "$cand"
      return 0
    fi
  done
  return 1
}

# Download and unpack release archive if source files are missing locally
ensure_source_files() {
  local s_script s_card s_mgr
  s_script="$(find_source_file "custom-repo.mjs" || true)"
  s_card="$(find_source_file "custom-package-card.hbs" || true)"
  s_mgr="$(find_source_file "custom-repo-manager.hbs" || true)"

  if [[ -n "$s_script" && -n "$s_card" && -n "$s_mgr" ]]; then
    return 0
  fi

  print_info "Patch files not found locally. Preparing download..."

  local temp_dir
  temp_dir="$(mktemp -d -t crm-fvtt-XXXXXX 2>/dev/null || mktemp -d /tmp/crm-fvtt-XXXXXX)"
  trap 'rm -rf "'"$temp_dir"'"' EXIT INT TERM

  local zip_url="https://github.com/deniztadice/crm-fvtt/releases/latest/download/crm-fvtt.zip"
  local zip_file="${temp_dir}/crm-fvtt.zip"
  local zip_downloaded=false

  print_info "Downloading latest release package from GitHub..."
  if command -v curl >/dev/null 2>&1; then
    if curl -sSL -f -o "$zip_file" "$zip_url" 2>/dev/null; then
      zip_downloaded=true
    fi
  elif command -v wget >/dev/null 2>&1; then
    if wget -q -O "$zip_file" "$zip_url" 2>/dev/null; then
      zip_downloaded=true
    fi
  fi

  if [[ "$zip_downloaded" = true && -s "$zip_file" ]] && command -v unzip >/dev/null 2>&1; then
    print_info "Extracting release archive..."
    if unzip -q -o "$zip_file" -d "$temp_dir" 2>/dev/null; then
      SCRIPT_DIR="$temp_dir"
      return 0
    fi
  fi

  # Fallback to direct raw downloads if release zip is not yet published or unzip is missing
  print_warn "Release archive not available yet. Downloading files directly from repository..."
  local raw_base="https://raw.githubusercontent.com/deniztadice/crm-fvtt/main/script"
  local needed_files=("custom-repo.mjs" "custom-package-card.hbs" "custom-repo-manager.hbs")

  for nf in "${needed_files[@]}"; do
    local out_path="${temp_dir}/${nf}"
    if command -v curl >/dev/null 2>&1; then
      curl -sSL -f -o "$out_path" "${raw_base}/${nf}" 2>/dev/null || true
    elif command -v wget >/dev/null 2>&1; then
      wget -q -O "$out_path" "${raw_base}/${nf}" 2>/dev/null || true
    fi
  done

  SCRIPT_DIR="$temp_dir"
}

ensure_source_files

SRC_SCRIPT="$(find_source_file "custom-repo.mjs" || true)"
SRC_CARD_TPL="$(find_source_file "custom-package-card.hbs" || true)"
SRC_MANAGER_TPL="$(find_source_file "custom-repo-manager.hbs" || true)"

if [[ -z "$SRC_SCRIPT" || -z "$SRC_CARD_TPL" || -z "$SRC_MANAGER_TPL" ]]; then
  print_error "Could not locate all source files for the patch:"
  [[ -z "$SRC_SCRIPT" ]] && echo "  - Missing custom-repo.mjs"
  [[ -z "$SRC_CARD_TPL" ]] && echo "  - Missing custom-package-card.hbs"
  [[ -z "$SRC_MANAGER_TPL" ]] && echo "  - Missing custom-repo-manager.hbs"
  exit 1
fi

# Ensure target directories exist
mkdir -p "$PUBLIC_SCRIPTS_DIR"
mkdir -p "$PUBLIC_DIR"
mkdir -p "$PUBLIC_TEMPLATES_DIR"

# Copy files helper
copy_file_if_different() {
  local src="$1"
  local dst="$2"
  if [[ "$src" != "$dst" ]]; then
    cp "$src" "$dst"
    chmod 644 "$dst"
    print_success "Installed $(basename "$dst") -> $(basename "$(dirname "$dst")")/"
  else
    print_info "File $(basename "$dst") is already in place."
  fi
}

# Install script
copy_file_if_different "$SRC_SCRIPT" "${PUBLIC_SCRIPTS_DIR}/custom-repo.mjs"

# Install templates to public/ (primary) and public/templates/ (compatibility)
copy_file_if_different "$SRC_CARD_TPL" "${PUBLIC_DIR}/custom-package-card.hbs"
copy_file_if_different "$SRC_MANAGER_TPL" "${PUBLIC_DIR}/custom-repo-manager.hbs"

copy_file_if_different "$SRC_CARD_TPL" "${PUBLIC_TEMPLATES_DIR}/custom-package-card.hbs"
copy_file_if_different "$SRC_MANAGER_TPL" "${PUBLIC_TEMPLATES_DIR}/custom-repo-manager.hbs"

# Patch setup.hbs
print_info "Checking ${SETUP_HBS}..."

if grep -q "custom-repo.mjs" "$SETUP_HBS"; then
  print_info "setup.hbs is already patched with custom-repo.mjs."
else
  # Create backup if not already present
  if [[ ! -f "$BACKUP_SETUP_HBS" ]]; then
    cp "$SETUP_HBS" "$BACKUP_SETUP_HBS"
    print_info "Created backup: ${BACKUP_SETUP_HBS}"
  fi

  # Inject script tag right before </body>
  awk -v tag="$SCRIPT_TAG" '
    /<\/body>/ { print tag }
    { print }
  ' "$SETUP_HBS" > "${SETUP_HBS}.tmp" && mv "${SETUP_HBS}.tmp" "$SETUP_HBS"

  print_success "Injected module script into ${SETUP_HBS}"
fi

echo ""
print_success "Installation completed successfully!"
echo -e "${CLR_CYAN}Next steps:${CLR_RESET}"
echo "  1. Restart your Foundry VTT server."
echo "  2. Go to the \"Game Systems\" or \"Add-on Modules\" screen."
echo "  3. Click \"Install System/Module\" button."
echo "  4. You will see the \"Official\" and \"Custom\" switch with repository settings (⚙)."
echo ""
