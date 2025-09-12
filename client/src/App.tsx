import { Switch, Route } from "wouter";
import { queryClient, setAuthTokenGetter } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import SubmitDemo from "@/pages/submit-demo";
import Dashboard from "@/pages/dashboard";
import Settings from "@/pages/settings";
import Feed from "@/pages/feed";
import PaymentComplete from "@/pages/payment-complete";
import { useAuth } from "@/hooks/useAuth";
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect } from 'react';

// Load Stripe with error handling
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

// Get Clerk publishable key from environment variables
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

function AuthTokenSetter() {
  const { getToken } = useClerkAuth();
  
  useEffect(() => {
    // Use a Clerk JWT template to ensure a verifiable token for the backend
    setAuthTokenGetter(async () => {
      try {
        // Try to get a JWT using a template named 'default'
        const jwt = await getToken({ template: 'default' });
        if (jwt) return jwt;
      } catch (_) {
        // Fall through to session token
      }
      // Fallback to the standard session token if no JWT template exists
      return await getToken();
    });
  }, [getToken]);
  
  return null;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

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

        {/* Authenticated-only routes */}
        {isAuthenticated && (
          <>
            <Route path="/submit-demo" component={SubmitDemo} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/settings" component={Settings} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
