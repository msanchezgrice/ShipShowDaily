# Clerk Authentication Setup Guide

## Quick Fix for Authentication Errors

The authentication errors you're experiencing have been fixed in the code. Now you need to complete the Clerk configuration:

## Required Steps

### 1. Verify Environment Variables

Make sure these environment variables are set in both your local `.env` file and Vercel:

```env
# In your .env file (for local development)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Same variables in Vercel Dashboard > Settings > Environment Variables
```

### 2. Configure Clerk Dashboard

1. **Go to your [Clerk Dashboard](https://dashboard.clerk.com)**

2. **Check Application Settings:**
   - Navigate to your application
   - Go to **Settings > Domains**
   - Add your domains:
     - For local development: `http://localhost:5173`
     - For Vercel: `https://your-app.vercel.app`
     - Your custom domain (if any): `https://shipshow.io`

3. **Configure Redirect URLs:**
   - Go to **Settings > Paths**
   - Set the following:
     - Sign-in URL: `/`
     - Sign-up URL: `/`
     - After sign-in URL: `/dashboard`
     - After sign-up URL: `/dashboard`

4. **Enable Email/Password Authentication:**
   - Go to **User & Authentication > Email, Phone, Username**
   - Enable **Email address**
   - Enable **Password**

### 3. Clear Browser Cache

After making these changes:
1. Clear your browser cache and cookies for your domain
2. Try logging in again

### 4. Test the Authentication Flow

1. **Local Testing:**
   ```bash
   npm run dev
   ```
   - Visit `http://localhost:5173`
   - Try signing up/signing in

2. **Production Testing:**
   - Deploy to Vercel: `git push`
   - Visit your Vercel URL
   - Test authentication

## What Was Fixed

1. **Removed JWT Template Dependency**: The app was trying to use a non-existent JWT template called 'default'
2. **Added CORS Headers**: All API endpoints now properly handle CORS for cross-origin requests
3. **Improved Error Handling**: Better retry logic and error messages for authentication failures
4. **Token Refresh Logic**: Automatic token refresh when authentication fails

## Troubleshooting

If you still see authentication errors:

### Check Clerk Logs
1. Go to Clerk Dashboard > **Logs**
2. Look for any authentication failures
3. Check the error details

### Verify Token Format
Run this in browser console when logged in:
```javascript
// In browser console on your app
const token = await window.Clerk.session.getToken();
console.log('Token:', token);
```

### Check Network Tab
1. Open browser DevTools > Network tab
2. Look for `/api/auth/user` requests
3. Check:
   - Request headers (should have `Authorization: Bearer ...`)
   - Response status (should be 200)
   - Response headers (should have CORS headers)

### Common Issues

**"Unauthorized" Error:**
- Token might be expired → Clear cookies and login again
- Wrong Clerk keys → Double-check environment variables

**404 Errors:**
- API routes not deployed → Check Vercel deployment logs
- Wrong API URL → Ensure you're using the correct domain

**CORS Errors:**
- Domain not whitelisted → Add domain to Clerk settings
- Missing headers → The code fixes should have resolved this

## Need More Help?

1. Check Clerk's [troubleshooting guide](https://clerk.com/docs/troubleshooting)
2. Review the [Vercel deployment logs](https://vercel.com/dashboard)
3. Enable debug mode in Clerk for more detailed error messages

## Summary

The code has been updated to fix the authentication issues. Now you just need to:
1. ✅ Ensure environment variables are set correctly
2. ✅ Configure Clerk dashboard settings
3. ✅ Clear cache and test

The authentication should now work properly!
