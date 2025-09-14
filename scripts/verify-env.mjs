#!/usr/bin/env node

// This script verifies environment variables are set correctly
console.log("=".repeat(60));
console.log("ENVIRONMENT VARIABLES VERIFICATION");
console.log("=".repeat(60));

// Check for VITE_ prefixed variables (these are exposed to the client)
const viteVars = Object.keys(process.env).filter(key => key.startsWith('VITE_'));
console.log("\n📦 VITE Variables (exposed to client):");
if (viteVars.length === 0) {
  console.log("  ❌ No VITE_ variables found!");
  console.log("  ⚠️  The client app needs VITE_CLERK_PUBLISHABLE_KEY to work!");
} else {
  viteVars.forEach(key => {
    const value = process.env[key];
    const masked = value ? `${value.substring(0, 7)}...` : 'undefined';
    console.log(`  ${key}: ${masked}`);
  });
}

// Check for server-side variables
console.log("\n🔒 Server Variables (private):");
const serverVars = ['CLERK_SECRET_KEY', 'DATABASE_URL', 'STRIPE_SECRET_KEY'];
serverVars.forEach(key => {
  const value = process.env[key];
  if (value) {
    const masked = value.substring(0, 10) + '...';
    console.log(`  ✅ ${key}: ${masked}`);
  } else {
    console.log(`  ❌ ${key}: Not set`);
  }
});

// Check for wrong variable names
console.log("\n⚠️  Checking for common mistakes:");
const wrongVars = ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'REACT_APP_CLERK_PUBLISHABLE_KEY'];
wrongVars.forEach(key => {
  if (process.env[key]) {
    console.log(`  ❌ Found ${key} - This should be VITE_CLERK_PUBLISHABLE_KEY!`);
  }
});

console.log("\n" + "=".repeat(60));
console.log("REQUIRED VERCEL ENVIRONMENT VARIABLES:");
console.log("=".repeat(60));
console.log(`
In Vercel Dashboard → Settings → Environment Variables, you need:

1. VITE_CLERK_PUBLISHABLE_KEY = [Your pk_live_ key from Clerk Dashboard]
   (This MUST start with VITE_ to be available in the client)

2. CLERK_SECRET_KEY = [Your sk_live_ key from Clerk Dashboard]
   (Server-side only)

3. DATABASE_URL = [Your PostgreSQL connection string]
   (Server-side only)
`);

console.log("=".repeat(60));