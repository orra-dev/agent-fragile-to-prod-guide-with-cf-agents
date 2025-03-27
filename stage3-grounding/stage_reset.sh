#!/bin/bash

# Exit on error
set -e

echo "Starting reset process..."

# Define the base directory as the current directory
BASE_DIR="$(pwd)"
echo "Base directory: $BASE_DIR"

# Step 1: Reset orra configuration
echo "Resetting orra configuration..."
orra config reset

# Step 2: Remove orra dbstore
echo "Removing orra dbstore..."
rm -rf "$HOME/.orra/dbstore"

# Step 3: Remove .wrangler directories from top-level subdirectories
echo "Removing .wrangler directories..."
for dir in "$BASE_DIR"/*; do
    if [ -d "$dir" ]; then
        CF_LOCAL_DIR="$dir/.wrangler"
        if [ -d "$CF_LOCAL_DIR" ]; then
            echo "Removing $CF_LOCAL_DIR"
            rm -rf "$CF_LOCAL_DIR"
        fi
    fi
done

# Step 4: Clear ORRA_API_KEY in .dev.vars files
echo "Clearing ORRA_API_KEY in .dev.vars files..."
for dir in "$BASE_DIR"/*; do
    if [ -d "$dir" ]; then
        DEV_VARS_FILE="$dir/.dev.vars"
        if [ -f "$DEV_VARS_FILE" ]; then
            echo "Updating $DEV_VARS_FILE"
            # Replace the ORRA_API_KEY line with an empty value
            sed -i '' 's/^ORRA_API_KEY=.*$/ORRA_API_KEY=/' "$DEV_VARS_FILE"
        fi
    fi
done

echo "Reset completed successfully!"
