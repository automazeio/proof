#!/bin/sh
#
# proof install script
# https://automaze.io/install/proof
#
# Usage:
#   curl -fsSL https://automaze.io/install/proof | sh
#   curl -fsSL https://automaze.io/install/proof | sh -s -- --version 0.20260312.1
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"

# Parse arguments
VERSION=""
for arg in "$@"; do
    case $arg in
        --version)
            shift
            VERSION="$1"
            ;;
        --version=*)
            VERSION="${arg#*=}"
            ;;
    esac
done

# Detect platform
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$ARCH" in
    x86_64)       ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)
        printf "${CROSS} Unsupported architecture: %s\n" "$ARCH"
        exit 1
        ;;
esac

case "$OS" in
    linux|darwin) ;;
    *)
        printf "${CROSS} Unsupported OS: %s (use install.ps1 for Windows)\n" "$OS"
        exit 1
        ;;
esac

# Install directory
if [ "$(id -u)" = "0" ]; then
    INSTALL_DIR="/usr/local/bin"
else
    INSTALL_DIR="$HOME/.local/bin"
fi

# Resolve latest version if not specified
if [ -z "$VERSION" ]; then
    LATEST_URL=$(curl -sI "https://github.com/automazeio/proof/releases/latest" \
        | tr -d '\r' \
        | grep -i '^location:' \
        | awk '{print $2}')
    case "$LATEST_URL" in
        */tag/*)
            TAG=$(echo "$LATEST_URL" | sed 's|.*/tag/||')
            ;;
        *)
            TAG=""
            ;;
    esac
    if [ -z "$TAG" ]; then
        printf "${CROSS} No releases found. Check https://github.com/automazeio/proof/releases\n"
        exit 1
    fi
    VERSION=$(echo "$TAG" | sed 's|^v||')
else
    TAG="v${VERSION}"
fi

BINARY_NAME="proof-${OS}-${ARCH}"
DOWNLOAD_URL="https://github.com/automazeio/proof/releases/download/${TAG}/${BINARY_NAME}"

printf "\n"
printf "${BOLD}proof${NC} installer\n"
printf "\n"
printf "  Version:  ${CYAN}%s${NC}\n" "$VERSION"
printf "  Platform: ${CYAN}%s/%s${NC}\n" "$OS" "$ARCH"
printf "  Target:   ${CYAN}%s/proof${NC}\n" "$INSTALL_DIR"
printf "\n"

# Check for curl
if ! command -v curl >/dev/null 2>&1; then
    printf "${CROSS} curl is required but not installed\n"
    exit 1
fi

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download binary
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

printf "  Downloading..."
if ! curl -fsSL -o "$TMP_DIR/proof" "$DOWNLOAD_URL" 2>/dev/null; then
    printf "\n"
    printf "${CROSS} Download failed: %s\n" "$DOWNLOAD_URL"
    printf "\n"
    printf "  Check available versions at:\n"
    printf "  https://github.com/automazeio/proof/releases\n"
    exit 1
fi
printf " ${CHECK}\n"

# Install
chmod +x "$TMP_DIR/proof"
mv "$TMP_DIR/proof" "$INSTALL_DIR/proof"
printf "  Installed ${CHECK}\n"

# PATH check
PATH_UPDATED=0
case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *)
        SHELL_NAME=$(basename "${SHELL:-/bin/sh}")
        case "$SHELL_NAME" in
            bash)
                if [ "$OS" = "darwin" ]; then
                    SHELL_CONFIG="$HOME/.bash_profile"
                else
                    SHELL_CONFIG="$HOME/.bashrc"
                fi
                ;;
            zsh)  SHELL_CONFIG="$HOME/.zshrc" ;;
            fish) SHELL_CONFIG="$HOME/.config/fish/config.fish" ;;
            *)    SHELL_CONFIG="" ;;
        esac

        if [ -n "$SHELL_CONFIG" ]; then
            printf "\n" >> "$SHELL_CONFIG"
            printf "# Added by proof installer\n" >> "$SHELL_CONFIG"
            if [ "$SHELL_NAME" = "fish" ]; then
                printf "set -gx PATH %s \$PATH\n" "$INSTALL_DIR" >> "$SHELL_CONFIG"
            else
                printf "export PATH=\"%s:\$PATH\"\n" "$INSTALL_DIR" >> "$SHELL_CONFIG"
            fi
            PATH_UPDATED=1
        fi
        ;;
esac

printf "\n"
printf "${CHECK} proof %s installed successfully!\n" "$VERSION"
printf "\n"

if [ "$PATH_UPDATED" = "1" ]; then
    printf "  Run ${CYAN}source %s${NC} or open a new terminal.\n" "$SHELL_CONFIG"
    printf "\n"
fi

printf "  Get started:\n"
printf "    ${CYAN}proof capture --app my-app --command \"npm test\" --mode terminal${NC}\n"
printf "\n"
printf "  Docs: https://github.com/automazeio/proof\n"
printf "\n"
