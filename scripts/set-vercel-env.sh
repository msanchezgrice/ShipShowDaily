#!/bin/bash

# Set the DATABASE_URL environment variable in Vercel
# You need to have Vercel CLI installed and be logged in

echo "🔧 Setting DATABASE_URL in Vercel..."
echo ""
echo "This will add your database connection to Vercel's environment variables."
echo ""

DATABASE_URL="postgresql://neondb_owner:npg_XxoM9nHIdum6@ep-purple-shape-af5s27vg.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require"

# Set for all environments (production, preview, development)
npx vercel env add DATABASE_URL production <<< "$DATABASE_URL"
npx vercel env add DATABASE_URL preview <<< "$DATABASE_URL"  
npx vercel env add DATABASE_URL development <<< "$DATABASE_URL"

echo ""
echo "✅ DATABASE_URL has been added to Vercel!"
echo ""
echo "🚀 Now redeploy your application:"
echo "   npx vercel --prod"
echo ""
echo "Or trigger a redeploy from GitHub:"
echo "   git commit --allow-empty -m 'Trigger redeploy with DATABASE_URL' && git push"
