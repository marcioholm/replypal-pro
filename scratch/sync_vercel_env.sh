#!/bin/bash
# Script to push .env variables to Vercel

while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ $key =~ ^#.* ]] || [[ -z $key ]] && continue
  
  # Remove quotes if present
  value=$(echo "$value" | sed 's/^"//;s/"$//')
  
  echo "Adding $key..."
  echo "$value" | npx vercel env add "$key" production --force
  echo "$value" | npx vercel env add "$key" preview --force
  echo "$value" | npx vercel env add "$key" development --force
done < .env
