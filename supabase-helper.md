# Quick Supabase Connection Guide

## Where to Find Your Connection String

1. **Login to Supabase Dashboard**
2. **Click on your project**
3. **Go to Settings** (gear icon in sidebar)
4. **Click "Database"** in the left menu
5. **Look for "Connection string" section**
6. **Click on "URI"** tab
7. **Click the "Copy" button** - this gives you the COMPLETE connection string!

It will look like:
```
postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@YOUR_REGION.pooler.supabase.com:5432/postgres
```

For example:
```
postgresql://postgres.xyzabc123456:Allornothing1!@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

## For Connection Pooling (Recommended for Vercel):

Add `?pgbouncer=true` at the end:
```
postgresql://postgres.xyzabc123456:Allornothing1!@aws-0-us-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true
```

## Test Your Connection:

Once you have your URL, update your `.env.local`:
```
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:Allornothing1!@YOUR_REGION.pooler.supabase.com:5432/postgres?pgbouncer=true
```

Then test it:
```bash
npx tsx -e "
import { Pool } from '@neondatabase/serverless';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()').then(r => {
  console.log('✅ Connected! Current time:', r.rows[0].now);
  pool.end();
}).catch(e => console.error('❌ Connection failed:', e.message));
"
```
