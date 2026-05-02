#!/bin/bash
# Create a macOS app bundle for Claude History Viewer
# This creates a simple .app bundle that launches the dev server

set -e

APP_NAME="ClaudeHistory"
APP_BUNDLE="$APP_NAME.app"
CONTENTS="$APP_BUNDLE/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

echo "Creating $APP_BUNDLE..."

# Create app bundle structure
rm -rf "$APP_BUNDLE"
mkdir -p "$MACOS"
mkdir -p "$RESOURCES"

# Create Info.plist
cat > "$CONTENTS/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launch.sh</string>
    <key>CFBundleName</key>
    <string>ClaudeHistory</string>
    <key>CFBundleDisplayName</key>
    <string>Claude History</string>
    <key>CFBundleIdentifier</key>
    <string>com.claude.history</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# Copy the launch script
cp "$(dirname "$0")/launch.sh" "$MACOS/"
chmod +x "$MACOS/launch.sh"

# Create a simple icon (optional)
# For a real app, you would copy an actual .icns file here
# cp "$(dirname "$0")/../src-tauri/icons/icon.icns" "$RESOURCES/"

echo ""
echo "App bundle created: $APP_BUNDLE"
echo ""
echo "To install:"
echo "  1. Copy $APP_BUNDLE to /Applications/"
echo "  2. Double-click to launch"
echo ""
echo "Or run it from here:"
echo "  open $APP_BUNDLE"
