#!/bin/bash
# Validate locally and deploy Monica to Vercel.
set -e

REPO_DIR="/Users/joshua/Documents/Code/monica"

cd "$REPO_DIR"

echo "Running targeted stock hook tests..."
npm test -- --run src/hooks/useStocks.test.js

echo "Building production bundle..."
npm run build

echo "Deploying Monica to Vercel..."
vercel --prod --yes

echo "Done!"
echo "Verify the top ticker on https://monica.heyitsmejosh.com/"
