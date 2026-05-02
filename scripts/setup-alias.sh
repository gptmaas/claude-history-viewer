#!/bin/bash
# Setup shell alias for quick access to Claude History Viewer
# Add this alias to your shell configuration

SHELL_CONFIG=""
if [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bash_profile"
else
    echo "Unsupported shell. Please manually add the alias to your shell config."
    exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ALIAS_NAME="claude-history"

echo "Adding alias to $SHELL_CONFIG"
echo ""
echo "# Claude History Viewer alias" >> "$SHELL_CONFIG"
echo "alias $ALIAS_NAME='cd $PROJECT_DIR && npm run dev & sleep 3 && open http://localhost:3000'" >> "$SHELL_CONFIG"

echo ""
echo "Alias added! To use it:"
echo "  1. Restart your shell or run: source $SHELL_CONFIG"
echo "  2. Type: $ALIAS_NAME"
echo ""
echo "To uninstall, remove the alias line from $SHELL_CONFIG"
