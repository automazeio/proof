#!/bin/bash
#
# proof install script
# https://getproof.sh
#
# Usage:
#   curl -fsSL https://getproof.sh/install | sh
#   curl -fsSL https://getproof.sh/install | sh -s -- --version 0.20260312.1
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
        echo -e "${CROSS} Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

case "$OS" in
    linux|darwin) ;;
    *)
        echo -e "${CROSS} Unsupported OS: $OS (use install.ps1 for Windows)"
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
    VERSION=$(curl -sI "https://github.com/automazeio/proof/releases/latest" \
        | grep -i location \
        | sed 's|.*/tag/v||' \
        | tr -d '\r\n')
    if [ -z "$VERSION" ]; then
        echo -e "${CROSS} Failed to detect latest version"
        exit 1
    fi
fi

BINARY_NAME="proof-${OS}-${ARCH}"
DOWNLOAD_URL="https://github.com/automazeio/proof/releases/download/v${VERSION}/${BINARY_NAME}"

echo ""
echo -e "${BOLD}proof${NC} installer"
echo ""
echo -e "  Version:  ${CYAN}${VERSION}${NC}"
echo -e "  Platform: ${CYAN}${OS}/${ARCH}${NC}"
echo -e "  Target:   ${CYAN}${INSTALL_DIR}/proof${NC}"
echo ""

# Check for curl
if ! command -v curl >/dev/null 2>&1; then
    echo -e "${CROSS} curl is required but not installed"
    exit 1
fi

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download binary
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

printf "  Downloading..."
if ! curl -fsSL -o "$TMP_DIR/proof" "$DOWNLOAD_URL" 2>/dev/null; then
    echo ""
    echo -e "${CROSS} Download failed: $DOWNLOAD_URL"
    echo ""
    echo "  Check available versions at:"
    echo "  https://github.com/automazeio/proof/releases"
    exit 1
fi
echo -e " ${CHECK}"

# Install
chmod +x "$TMP_DIR/proof"
mv "$TMP_DIR/proof" "$INSTALL_DIR/proof"
echo -e "  Installed ${CHECK}"

# PATH check
PATH_UPDATED=0
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
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
        echo "" >> "$SHELL_CONFIG"
        echo "# Added by proof installer" >> "$SHELL_CONFIG"
        if [ "$SHELL_NAME" = "fish" ]; then
            echo "set -gx PATH $INSTALL_DIR \$PATH" >> "$SHELL_CONFIG"
        else
            echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$SHELL_CONFIG"
        fi
        PATH_UPDATED=1
    fi
fi

echo ""
echo -e "${CHECK} proof ${VERSION} installed successfully!"
echo ""

if [ "$PATH_UPDATED" = "1" ]; then
    echo -e "  Run ${CYAN}source $SHELL_CONFIG${NC} or open a new terminal."
    echo ""
fi

echo "  Get started:"
echo -e "    ${CYAN}proof capture --app my-app --command \"npm test\" --mode terminal${NC}"
echo ""
echo "  Docs: https://github.com/automazeio/proof"
echo ""
