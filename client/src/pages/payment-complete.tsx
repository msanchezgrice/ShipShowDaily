import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, CreditCard } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useStripe } from "@stripe/react-stripe-js";

interface PaymentCompleteState {
  status: 'loading' | 'success' | 'error' | 'already_processed';
  message: string;
  credits?: number;
  packageInfo?: string;
}

export default function PaymentComplete() {
  const [, setLocation] = useLocation();
  const [paymentState, setPaymentState] = useState<PaymentCompleteState>({
    status: 'loading',
    message: 'Processing your payment...'
  });
  const stripe = useStripe();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Complete credit purchase mutation
  const completePurchaseMutation = useMutation({
    mutationFn: async (paymentIntentId: string) => {
      const response = await apiRequest('POST', '/api/credits/purchase-complete', {
        paymentIntentId
      });
      return response;
    },
    onSuccess: (data: any) => {
      setPaymentState({
        status: 'success',
        message: 'Payment completed successfully!',
        credits: data.credits,
        packageInfo: `$${data.package?.price} package`
      });
      
      // Invalidate user query to refresh credits
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: "Payment successful!",
        description: `Successfully added ${data.credits} credits to your account.`,
      });
    },
    onError: (error: any) => {
      const isAlreadyProcessed = error.message?.includes('already processed');
      
      setPaymentState({
        status: isAlreadyProcessed ? 'already_processed' : 'error',
        message: isAlreadyProcessed 
          ? 'This payment has already been processed. Your credits should be available in your account.'
          : error.message || 'Failed to process payment. Please contact support if your payment was charged.'
      });

      if (isAlreadyProcessed) {
        // Still refresh user data in case credits were added
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        
        toast({
          title: "Payment already processed",
          description: "Your credits should already be available in your account.",
        });
      } else {
        toast({
          title: "Payment processing error",
          description: error.message || "There was an issue processing your payment.",
          variant: "destructive",
        });
      }
    },
  });

  useEffect(() => {
    const processPayment = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentIntentId = urlParams.get('payment_intent');
      const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');
      const redirectStatus = urlParams.get('redirect_status');

      // If no payment intent in URL, redirect to home
      if (!paymentIntentId) {
        setPaymentState({
          status: 'error',
          message: 'No payment information found. You may have accessed this page incorrectly.'
        });
        return;
      }

      try {
        // If we have stripe and client secret, we can check the payment intent status first
        if (stripe && paymentIntentClientSecret) {
          const { paymentIntent, error } = await stripe.retrievePaymentIntent(paymentIntentClientSecret);
          
          if (error) {
            console.error('Error retrieving payment intent:', error);
            setPaymentState({
              status: 'error',
              message: `Payment verification failed: ${error.message}`
            });
            return;
          }

          if (paymentIntent) {
            console.log('Payment Intent Status:', paymentIntent.status);
            
            // Handle different payment statuses
            switch (paymentIntent.status) {
              case 'succeeded':
                // Payment succeeded, complete the purchase
                completePurchaseMutation.mutate(paymentIntent.id);
                break;
              
              case 'processing':
                setPaymentState({
                  status: 'loading',
                  message: 'Your payment is being processed. Please wait...'
                });
                
                // Set up polling to check status periodically
                const pollInterval = setInterval(async () => {
                  try {
                    const { paymentIntent: updatedPI } = await stripe.retrievePaymentIntent(paymentIntentClientSecret);
                    if (updatedPI?.status === 'succeeded') {
                      clearInterval(pollInterval);
                      completePurchaseMutation.mutate(updatedPI.id);
                    } else if (updatedPI?.status === 'canceled' || updatedPI?.status === 'requires_payment_method') {
                      clearInterval(pollInterval);
                      setPaymentState({
                        status: 'error',
                        message: 'Payment was canceled or failed. Please try again.'
                      });
                    }
                  } catch (error) {
                    console.error('Error polling payment status:', error);
                    clearInterval(pollInterval);
                  }
                }, 2000);

                // Clear polling after 2 minutes
                setTimeout(() => clearInterval(pollInterval), 120000);
                break;
              
              case 'requires_payment_method':
              case 'canceled':
                setPaymentState({
                  status: 'error',
                  message: 'Payment was not completed successfully. Please try again.'
                });
                break;
              
              default:
                setPaymentState({
                  status: 'error',
                  message: `Payment status: ${paymentIntent.status}. Please contact support if you believe this is an error.`
                });
            }
          }
        } else {
          // Fallback: directly try to complete the purchase with the payment intent ID
          completePurchaseMutation.mutate(paymentIntentId);
        }
      } catch (error: any) {
        console.error('Error processing payment completion:', error);
        setPaymentState({
          status: 'error',
          message: 'An unexpected error occurred while processing your payment.'
        });
      }
    };

    processPayment();
  }, [stripe, completePurchaseMutation]);

  const handleGoHome = () => {
    setLocation('/');
  };

  const handleGoToDashboard = () => {
    setLocation('/dashboard');
  };

  const getStatusIcon = () => {
    switch (paymentState.status) {
      case 'loading':
        return <Loader2 className="h-16 w-16 text-primary animate-spin" />;
      case 'success':
      case 'already_processed':
        return <CheckCircle className="h-16 w-16 text-green-500" />;
      case 'error':
        return <XCircle className="h-16 w-16 text-red-500" />;
      default:
        return <CreditCard className="h-16 w-16 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (paymentState.status) {
      case 'success':
      case 'already_processed':
        return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950';
      case 'error':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950';
      case 'loading':
        return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className={`w-full max-w-md ${getStatusColor()}`}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-2xl">
            {paymentState.status === 'loading' && 'Processing Payment'}
            {paymentState.status === 'success' && 'Payment Successful!'}
            {paymentState.status === 'already_processed' && 'Payment Complete'}
            {paymentState.status === 'error' && 'Payment Issue'}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            {paymentState.message}
          </p>
          
          {paymentState.credits && paymentState.packageInfo && (
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-lg font-semibold">
                {paymentState.credits.toLocaleString()} Credits Added
              </div>
              <div className="text-sm text-muted-foreground">
                {paymentState.packageInfo}
              </div>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            {(paymentState.status === 'success' || paymentState.status === 'already_processed') && (
              <Button 
                onClick={handleGoToDashboard} 
                className="w-full"
                data-testid="button-go-to-dashboard"
              >
                Go to Dashboard
              </Button>
            )}
            
            <Button 
              variant={paymentState.status === 'success' || paymentState.status === 'already_processed' ? 'outline' : 'default'}
              onClick={handleGoHome} 
              className="w-full"
              data-testid="button-go-home"
            >
              {paymentState.status === 'error' ? 'Try Again' : 'Back to Home'}
            </Button>
          </div>
          
          {paymentState.status === 'error' && (
            <p className="text-xs text-center text-muted-foreground">
              If you were charged but didn't receive credits, please contact support with your payment details.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}