#!/bin/bash

# Exit on error
set -e

echo "Starting setup process..."

# Define the base directory as the current directory
BASE_DIR="$(pwd)"
echo "Base directory: $BASE_DIR"

# Step 1: Add a project to the orra plan engine
echo "Adding project to orra plan engine..."
orra projects add assistant

# Step 2: Add a webhook to the project
echo "Adding webhook to the project..."
orra webhooks add http://localhost:3000/webhook

# Step 3: Generate a new API key for the project
echo "Generating new API key..."
API_KEY_OUTPUT=$(orra api-keys gen assist-key)
echo "$API_KEY_OUTPUT"

# Step 4: Extract the API key from the output
# Extract the API key from the output, ensuring whitespace is trimmed
ORRA_API_KEY=$(echo "$API_KEY_OUTPUT" | grep "KEY:" | sed 's/^[[:space:]]*KEY:[[:space:]]*//' | tr -d '[:space:]')

if [ -z "$ORRA_API_KEY" ]; then
  echo "Error: Could not extract API key from output"
  exit 1
fi

echo "Extracted API key: $ORRA_API_KEY"

# Step 5: Check for .env-example files and copy to .env if needed
echo "Checking for .env-example files..."
for dir in "$BASE_DIR"/*; do
  if [ -d "$dir" ]; then
    ENV_FILE="$dir/.env"
    ENV_EXAMPLE_FILE="$dir/.env-example"

    # If .env doesn't exist but .env-example does, copy it
    if [ ! -f "$ENV_FILE" ] && [ -f "$ENV_EXAMPLE_FILE" ]; then
      echo "Creating $ENV_FILE from $ENV_EXAMPLE_FILE"
      cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
    fi
  fi
done

# Step 6: Add the ORRA_API_KEY to all .dev.vars files
echo "Adding ORRA_API_KEY to environment files..."
for dir in "$BASE_DIR"/*; do
  if [ -d "$dir" ]; then
    # Handle .dev.vars files for Cloudflare Workers
    DEV_VARS_FILE="$dir/.dev.vars"
    if [ -f "$DEV_VARS_FILE" ]; then
      echo "Updating $DEV_VARS_FILE"
      # Check if ORRA_API_KEY line exists in the file
      if grep -q "^ORRA_API_KEY=" "$DEV_VARS_FILE"; then
        # Replace existing ORRA_API_KEY line
        sed -i '' "s|^ORRA_API_KEY=.*$|ORRA_API_KEY=$ORRA_API_KEY|" "$DEV_VARS_FILE"
      else
        # Add ORRA_API_KEY line if it doesn't exist
        echo "ORRA_API_KEY=$ORRA_API_KEY" >> "$DEV_VARS_FILE"
      fi
    fi
  fi
done

echo "Setup completed successfully!"
