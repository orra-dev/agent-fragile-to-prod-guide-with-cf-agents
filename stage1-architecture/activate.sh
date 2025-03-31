#!/bin/bash

# Script to activate all components in the stage1-architecture directory
# Looks for wrangler.jsonc files, extracts the port number, and makes a GET request to activate each component

echo "Starting component activation script..."
echo "----------------------------------------"

# Define stage directory
STAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to extract port number from wrangler.jsonc
extract_port() {
    local wrangler_file="$1"
    local port=$(grep -o '"port":\s*[0-9]*' "$wrangler_file" | grep -o '[0-9]*')
    echo "$port"
}

# Function to extract component name from wrangler.jsonc
extract_name() {
    local wrangler_file="$1"
    local name=$(grep -o '"name":\s*"[^"]*"' "$wrangler_file" | cut -d'"' -f4)
    echo "$name"
}

# Count for successful activations
success_count=0
total_count=0

# Find all directories with wrangler.jsonc files
for comp_dir in "$STAGE_DIR"/*/ ; do
    if [ -d "$comp_dir" ]; then
        wrangler_file="$comp_dir/wrangler.jsonc"
        
        if [ -f "$wrangler_file" ]; then
            total_count=$((total_count + 1))
            component_name=$(extract_name "$wrangler_file")
            port=$(extract_port "$wrangler_file")
            
            if [ -n "$port" ]; then
                echo "Activating $component_name on port $port..."
                
                # Make GET request to activate the component
                response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health")
                
                if [ "$response" = "200" ] || [ "$response" = "204" ]; then
                    echo "✅ Successfully activated $component_name (HTTP $response)"
                    success_count=$((success_count + 1))
                else
                    echo "❌ Failed to activate $component_name (HTTP $response)"
                fi
            else
                echo "⚠️ Could not find port for $component_name, skipping"
            fi
        fi
    fi
done

echo "----------------------------------------"
echo "Activation complete: $success_count of $total_count components activated successfully"

# Exit with error code if not all components were successfully activated
if [ "$success_count" -ne "$total_count" ]; then
    exit 1
fi

exit 0
