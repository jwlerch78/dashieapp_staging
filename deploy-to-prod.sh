#!/bin/bash

# ===============================
# Function: Deploy staging to production
# Purpose: Copy main branch from dashieapp_staging to dashieapp (prod)
# Usage: ./deploy-to-prod.sh
# ===============================

set -e  # Exit on error

STAGING_PATH="$HOME/projects/dashieapp_staging"
PROD_REPO_NAME="dashieapp"
GITHUB_USER="jwlerch78"
PROD_REPO_URL="git@github.com:${GITHUB_USER}/${PROD_REPO_NAME}.git"

echo ""
echo "🚀 Deploying from: $STAGING_PATH"
echo "   To: $PROD_REPO_URL"
echo ""

# Navigate to staging repo
cd "$STAGING_PATH" || exit 1

# Ensure we're on main branch
echo "📌 Switching to main branch..."
git checkout main

# Detect first remote
FIRST_REMOTE=$(git remote | head -n 1)
if [ -z "$FIRST_REMOTE" ]; then
    echo "❌ ERR: No remotes found in this repo."
    exit 1
fi

echo "🔍 Using remote '$FIRST_REMOTE' for pulling latest changes."

# Check for uncommitted changes
echo "🔍 Checking for uncommitted changes..."
if ! git diff-index --quiet HEAD --; then
    echo "❌ ERR: You have uncommitted changes."
    echo "Please commit or stash them before deploying."
    exit 1
fi

# Pull latest changes
echo "⬇️  Pulling latest changes from $FIRST_REMOTE main..."
git pull "$FIRST_REMOTE" main

# Add production remote if not already added
if ! git remote get-url "$PROD_REPO_NAME" &> /dev/null; then
    echo "🔗 Adding remote $PROD_REPO_NAME..."
    git remote add "$PROD_REPO_NAME" "$PROD_REPO_URL"
fi

# Push to production
echo "⬆️  Pushing to $PROD_REPO_NAME main branch..."
git push --force-with-lease "$PROD_REPO_NAME" main:main

echo ""
echo "✅ Successfully pushed main branch to $PROD_REPO_NAME main."
echo "🎉 Deployment complete!"
echo ""