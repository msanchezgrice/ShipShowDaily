# Complete Clerk Configuration Checklist

## 1. Clerk Dashboard Settings (dashboard.clerk.com)

### API Keys
1. Go to **API Keys** section
2. Copy these values:
   - **Publishable Key**: `pk_test_...` or `pk_live_...`
   - **Secret Key**: `sk_test_...` or `sk_live_...`

### Domains & URLs
1. Go to **Settings > Domains**
2. Add ALL these domains (click "Add domain" for each):
   ```
   http://localhost:5173
   http://localhost:5174
   https://ship-show-daily.vercel.app
   https://ship-show-daily-*.vercel.app
   https://shipshow.io
   https://www.shipshow.io
   ```

### Application Settings
1. Go to **Settings > General**
2. Set these values:
   - **Application name**: ShipShow Daily
   - **Support email**: your-email@example.com
   - **Privacy policy URL**: Leave empty or add if you have one
   - **Terms of service URL**: Leave empty or add if you have one

### Paths Configuration
1. Go to **Paths**
2. Configure these EXACT settings:
   ```
   Sign-in URL: /
   Sign-up URL: /
   After sign-in URL: /dashboard
   After sign-up URL: /dashboard
   After sign-out URL: /
   ```

### User & Authentication Settings
1. Go to **User & Authentication > Email, Phone, Username**
2. Enable:
   - ✅ Email address (Required)
   - ✅ Password
   - ❌ Phone number (Disabled)
   - ❌ Username (Disabled)

3. Go to **User & Authentication > Social connections**
4. Optional - Enable any social providers you want:
   - Google
   - GitHub
   - etc.

### Sessions Configuration
1. Go to **Sessions**
2. Set:
   - **Session lifetime**: 7 days (or your preference)
   - **Session timeout**: 30 minutes (or your preference)
   - **Multi-session handling**: Single session per user

### JWT Templates (IMPORTANT!)
1. Go to **JWT Templates**
2. You should have NO custom templates
3. If you see any template named "default" or similar, DELETE IT
4. The app uses Clerk's standard session tokens, NOT custom JWT templates

### Webhooks (Optional)
1. Go to **Webhooks**
2. You don't need any webhooks for basic functionality

### Security Settings
1. Go to **Security**
2. Recommended settings:
   - **Bot protection**: Enabled
   - **Email verification**: Required
   - **Passwordless sign-in**: Disabled (unless you want it)

## 2. Environment Variables

### Local Development (.env file)
Create/update `.env` file in your project root:
```env
# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_KEY_HERE

# Database
DATABASE_URL=postgresql://neondb_owner:npg_XxoM9nHIdum6@ep-purple-shape-af5s27vg.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require

# Stripe (optional)
VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_STRIPE_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Google Cloud Storage (optional)
GCS_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name
```

### Vercel Environment Variables
1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Add THESE EXACT variables:

```
VITE_CLERK_PUBLISHABLE_KEY = pk_test_YOUR_KEY_HERE
CLERK_SECRET_KEY = sk_test_YOUR_KEY_HERE
DATABASE_URL = postgresql://neondb_owner:npg_XxoM9nHIdum6@ep-purple-shape-af5s27vg.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require
```

⚠️ **IMPORTANT**: Make sure there are NO spaces in the values and NO quotes around them!

## 3. Vercel Project Settings

1. Go to Vercel Dashboard > Your Project > Settings
2. **General Settings:**
   - Framework Preset: Other
   - Build Command: `npm run build`
   - Output Directory: `dist/public`
   - Install Command: `npm install`

3. **Node.js Version:**
   - Should be automatically detected as 22.x from `.nvmrc`

4. **Environment Variables:**
   - Ensure all variables from step 2 are added
   - Check they're enabled for: Production, Preview, Development

5. **Deployment Protection:**
   - Go to Settings > Deployment Protection
   - Set to: **Disabled** (or configure as needed)
   - If enabled, it will block public access to your site

## 4. Testing Checklist

### Local Testing
```bash
# 1. Install dependencies
npm install

# 2. Run development server
npm run dev

# 3. Open browser to http://localhost:5173
```

Test these actions:
- [ ] Homepage loads without errors
- [ ] Can open sign-in modal
- [ ] Can sign up with email/password
- [ ] Can sign in with existing account
- [ ] Dashboard loads after sign-in
- [ ] API calls work (check Network tab)

### Production Testing
```bash
# 1. Deploy to Vercel
git add .
git commit -m "Update configuration"
git push origin main

# 2. Wait for deployment to complete
# 3. Visit your Vercel URL
```

Test same actions as local testing.

## 5. Debugging Commands

### Check Clerk Status in Browser Console
```javascript
// Check if Clerk is loaded
console.log('Clerk loaded:', !!window.Clerk);

// Check if user is signed in
console.log('Signed in:', window.Clerk?.user);

// Get current session token
const token = await window.Clerk?.session?.getToken();
console.log('Token:', token);

// Decode token (to see contents)
if (token) {
  const parts = token.split('.');
  const payload = JSON.parse(atob(parts[1]));
  console.log('Token payload:', payload);
}
```

### Test API Directly
```bash
# Get a token from browser console first, then:
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  https://your-app.vercel.app/api/auth/user-simple
```

## 6. Common Issues & Solutions

### "Clerk not available" Error
**Solution:** Clerk is not loaded yet. Check:
- VITE_CLERK_PUBLISHABLE_KEY is set
- No typos in the environment variable name
- Clear browser cache

### "ERR_MODULE_NOT_FOUND" in Vercel Logs
**Solution:** API routes can't find dependencies. Check:
- All imports use relative paths within `api` folder
- `vercel.json` has correct configuration
- Force redeploy: `npx vercel --prod --force`

### "401 Unauthorized" on API Calls
**Solution:** Token verification failing. Check:
- CLERK_SECRET_KEY is set in Vercel
- Token is being sent in Authorization header
- Session hasn't expired

### Black Screen After Loading
**Solution:** React rendering error. Check:
- Browser console for React errors
- Network tab for failed API calls
- Clerk initialization completed

## 7. Required Clerk Settings Summary

✅ **MUST HAVE:**
- Publishable Key and Secret Key in environment variables
- Domains whitelisted in Clerk dashboard
- Email/Password authentication enabled
- NO custom JWT templates

✅ **PATHS:**
- All paths set to `/` or `/dashboard` as specified above

✅ **SESSIONS:**
- Standard session configuration (no custom settings needed)

❌ **DO NOT:**
- Create custom JWT templates
- Use Clerk hosted pages (accounts.shipshow.io)
- Enable passwordless unless specifically wanted
- Use webhook endpoints unless needed

## Final Verification

Run this verification script in your terminal:
```bash
# Check environment variables are set
echo "Checking environment variables..."
[ -n "$VITE_CLERK_PUBLISHABLE_KEY" ] && echo "✓ VITE_CLERK_PUBLISHABLE_KEY set" || echo "✗ VITE_CLERK_PUBLISHABLE_KEY missing"
[ -n "$CLERK_SECRET_KEY" ] && echo "✓ CLERK_SECRET_KEY set" || echo "✗ CLERK_SECRET_KEY missing"
[ -n "$DATABASE_URL" ] && echo "✓ DATABASE_URL set" || echo "✗ DATABASE_URL missing"
```

After completing ALL these settings, your app should work correctly!
