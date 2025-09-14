import { Switch, Route } from "wouter";
import { queryClient, setAuthTokenGetter } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, useAuth as useClerkAuth, ClerkLoaded, ClerkLoading } from "@clerk/clerk-react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import SubmitDemo from "@/pages/submit-demo";
import Dashboard from "@/pages/dashboard";
import Settings from "@/pages/settings";
import Feed from "@/pages/feed";
import PaymentComplete from "@/pages/payment-complete";
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect } from 'react';
import { UploadQueueProvider } from '@/components/UploadQueue';

// Load Stripe with error handling
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

// Get Clerk publishable key from environment variables
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Debug logging for production
if (typeof window !== 'undefined') {
  console.log('Clerk Config:', {
    hasKey: !!CLERK_PUBLISHABLE_KEY,
    keyPrefix: CLERK_PUBLISHABLE_KEY?.substring(0, 7),
    environment: import.meta.env.MODE,
    allEnvKeys: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
  });
}

if (!CLERK_PUBLISHABLE_KEY) {
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
  console.error("Available env vars:", Object.keys(import.meta.env));
}

function AuthTokenSetter() {
  const { getToken } = useClerkAuth();
  
  useEffect(() => {
    // Set up the auth token getter for API requests
    setAuthTokenGetter(async () => {
      try {
        // Get the default session token (includes standard claims)
        const token = await getToken();
        return token;
      } catch (error) {
        console.warn('Failed to get auth token:', error);
        return null;
      }
    });
  }, [getToken]);
  
  return null;
}

function Router() {
  // Remove useAuth from here - it's not needed and causes context issues
  return (
    <>
      <AuthTokenSetter />
      <Switch>
        {/* Payment complete route - accessible to all users */}
        <Route path="/payment-complete">
          {stripePromise ? (
            <Elements stripe={stripePromise}>
              <PaymentComplete />
            </Elements>
          ) : (
            <PaymentComplete />
          )}
        </Route>
        
        {/* Public routes */}
        <Route path="/" component={Home} />
        <Route path="/feed" component={Feed} />

        {/* Routes render regardless; components handle auth gating */}
        <Route path="/submit-demo" component={SubmitDemo} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  // If no Clerk key, show error message
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h1>
          <p className="text-gray-700 mb-4">
            The authentication system is not properly configured. 
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Missing: VITE_CLERK_PUBLISHABLE_KEY
          </p>
          <div className="bg-gray-100 rounded p-4">
            <p className="text-xs text-gray-600">
              Environment: {import.meta.env.MODE}
            </p>
            <p className="text-xs text-gray-600">
              Available keys: {Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')).join(', ') || 'None'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <ClerkLoading>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading authentication...</p>
          </div>
        </div>
      </ClerkLoading>
            <ClerkLoaded>
              <QueryClientProvider client={queryClient}>
                <UploadQueueProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Router />
                  </TooltipProvider>
                </UploadQueueProvider>
              </QueryClientProvider>
            </ClerkLoaded>
    </ClerkProvider>
  );
}

export default App;