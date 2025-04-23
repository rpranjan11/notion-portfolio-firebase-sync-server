#!/usr/bin/env bash
# Exit on error
set -o errexit

# Create Firebase admin SDK service account file from environment variable
echo "$FIREBASE_SERVICE_ACCOUNT_JSON" > ./theranjana-portfolio-firebase-adminsdk-fbsvc-e46e9045f5.json

# Regular build commands
npm install