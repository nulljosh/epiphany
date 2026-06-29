#!/bin/sh
# Xcode Cloud: regenerate project from project.yml before building
set -e

# Determine working directory
if [ -d "$CI_PRIMARY_REPOSITORY_PATH/apps/epiphany/ios" ]; then
    WD="$CI_PRIMARY_REPOSITORY_PATH/apps/epiphany/ios"
elif [ -d "$CI_PRIMARY_REPOSITORY_PATH/epiphany/ios" ]; then
    WD="$CI_PRIMARY_REPOSITORY_PATH/epiphany/ios"
else
    WD="$(dirname "$0")/.."
fi

cd "$WD" || exit 1

# Ensure xcodegen is available (prefer brew, fallback to system)
if ! command -v xcodegen &> /dev/null; then
    echo "Installing xcodegen via brew..."
    brew install xcodegen || {
        echo "Warning: brew install failed, attempting alternative methods"
        # Fallback: check if it's in common paths or pre-installed
        if [ ! -f /usr/local/bin/xcodegen ] && [ ! -f /opt/homebrew/bin/xcodegen ]; then
            echo "Error: xcodegen not available. Aborting."
            exit 1
        fi
    }
fi

# Generate project
echo "Regenerating Xcode project from project.yml..."
xcodegen generate || {
    echo "Error: xcodegen generate failed"
    exit 1
}

echo "Project regeneration complete"
