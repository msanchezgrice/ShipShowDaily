import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

// Load Stripe with error handling
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
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
      
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/feed" component={Feed} />
          <Route path="/submit-demo" component={SubmitDemo} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/settings" component={Settings} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
