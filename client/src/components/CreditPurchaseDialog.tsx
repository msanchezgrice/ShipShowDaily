import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Coins, CreditCard, Zap, Crown, Star, ArrowLeft } from "lucide-react";
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from "@/lib/queryClient";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  popular?: boolean;
  bonus?: number;
  description: string;
}

const creditPackages: CreditPackage[] = [
  {
    id: "starter",
    credits: 100,
    price: 5,
    description: "Perfect for getting started"
  },
  {
    id: "popular",
    credits: 500,
    price: 20,
    popular: true,
    bonus: 50,
    description: "Most popular choice"
  },
  {
    id: "pro",
    credits: 1000,
    price: 35,
    bonus: 200,
    description: "Best value for power users"
  },
  {
    id: "premium",
    credits: 2500,
    price: 75,
    bonus: 750,
    description: "Maximum impact package"
  }
];

interface CreditPurchaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  requiredCredits?: number;
  onPurchaseSuccess?: () => void;
}

// Checkout form component that handles Stripe payment
const CheckoutForm = ({ 
  selectedPackage, 
  onSuccess, 
  onError, 
  onBack 
}: { 
  selectedPackage: CreditPackage; 
  onSuccess: (data: any) => void; 
  onError: (error: any) => void;
  onBack: () => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-complete`,
        },
      });

      if (result.error) {
        // Handle different error types
        onError(result.error);
        return;
      }

      // Type assertion - we know there's no error, so paymentIntent should exist
      const paymentIntent = (result as unknown as { paymentIntent: any }).paymentIntent;
      
      // We know there's no error, so check for paymentIntent
      if (!paymentIntent) {
        // This case means payment was redirected for 3DS - user will be sent to payment-complete page
        console.log('Payment redirected for 3D Secure authentication');
        return;
      }

      // Handle different payment intent statuses
      switch (paymentIntent.status) {
        case 'succeeded':
          // Payment succeeded, complete the purchase
          try {
            const response = await apiRequest('POST', '/api/credits/purchase-complete', {
              paymentIntentId: paymentIntent.id
            });
            onSuccess(response);
          } catch (apiError: any) {
            // If webhook already processed the payment, still show success
            if (apiError.message?.includes('already processed')) {
              onSuccess({ 
                credits: parseInt(paymentIntent.metadata?.totalCredits || '0'),
                message: 'Payment completed successfully!'
              });
            } else {
              onError(apiError);
            }
          }
          break;
        
        case 'processing':
          // Payment is being processed (usually for delayed payment methods)
          onSuccess({ 
            credits: parseInt(paymentIntent.metadata?.totalCredits || '0'),
            message: 'Payment is being processed. Credits will be added to your account shortly.',
            processing: true
          });
          break;
        
        case 'requires_payment_method':
          onError({ message: 'Your payment method was declined. Please try a different payment method.' });
          break;
        
        case 'requires_confirmation':
          onError({ message: 'Payment requires additional confirmation. Please try again.' });
          break;
        
        case 'requires_action':
          // This shouldn't happen with our setup, but handle gracefully
          onError({ message: 'Payment requires additional action. Please complete the payment process.' });
          break;
        
        case 'canceled':
          onError({ message: 'Payment was canceled. Please try again.' });
          break;
        
        default:
          onError({ message: `Payment status: ${paymentIntent.status}. Please contact support if you need assistance.` });
      }
    } catch (err: any) {
      onError(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const totalCredits = selectedPackage.credits + (selectedPackage.bonus || 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-muted/50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">{selectedPackage.credits.toLocaleString()} Credits</h4>
            {selectedPackage.bonus && (
              <p className="text-sm text-accent">+ {selectedPackage.bonus} bonus credits</p>
            )}
            <p className="text-sm text-muted-foreground">
              Total: {totalCredits.toLocaleString()} credits
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">${selectedPackage.price}</div>
          </div>
        </div>
      </div>
      
      <PaymentElement />
      
      <div className="flex gap-3">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onBack}
          disabled={isProcessing}
          className="flex items-center"
          data-testid="button-back-to-packages"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || isProcessing}
          className="flex-1 flex items-center justify-center"
          data-testid="button-pay-with-stripe"
        >
          <CreditCard className="mr-2 h-4 w-4" />
          {isProcessing ? "Processing..." : `Pay $${selectedPackage.price}`}
        </Button>
      </div>
    </form>
  );
};

export default function CreditPurchaseDialog({
  isOpen,
  onClose,
  requiredCredits,
  onPurchaseSuccess
}: CreditPurchaseDialogProps) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [packageData, setPackageData] = useState<CreditPackage | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create payment intent when package is selected
  const createPaymentIntentMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await apiRequest('POST', '/api/credits/create-payment-intent', {
        packageId
      });
      return response;
    },
    onSuccess: (data: any) => {
      setClientSecret(data.clientSecret);
      setPackageData(data.package);
      setShowCheckout(true);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePackageSelect = (packageId: string) => {
    setSelectedPackage(packageId);
    createPaymentIntentMutation.mutate(packageId);
  };

  const handlePaymentSuccess = (data: any) => {
    toast({
      title: "Payment successful!",
      description: `Successfully added ${data.credits} credits to your account.`,
    });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    onPurchaseSuccess?.();
    handleClose();
  };

  const handlePaymentError = (error: any) => {
    toast({
      title: "Payment failed",
      description: error.message || "Failed to process payment. Please try again.",
      variant: "destructive",
    });
  };

  const handleClose = () => {
    setSelectedPackage(null);
    setClientSecret(null);
    setPackageData(null);
    setShowCheckout(false);
    onClose();
  };

  const handleBackToPackages = () => {
    setSelectedPackage(null);
    setClientSecret(null);
    setPackageData(null);
    setShowCheckout(false);
  };

  const getTotalCredits = (pkg: CreditPackage) => {
    return pkg.credits + (pkg.bonus || 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <Coins className="text-primary mr-2 h-6 w-6" />
            {showCheckout ? "Complete Payment" : "Purchase Credits"}
          </DialogTitle>
          <DialogDescription>
            {showCheckout ? (
              "Complete your payment using the secure form below."
            ) : requiredCredits ? (
              <>You need <strong>{requiredCredits} credits</strong> to boost this video. Choose a credit package below to continue.</>
            ) : (
              <>Choose a credit package to boost your videos and increase their visibility on the leaderboard.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {showCheckout ? (
          // Stripe checkout form
          clientSecret && packageData ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm 
                selectedPackage={packageData}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onBack={handleBackToPackages}
              />
            </Elements>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
              <span className="ml-3">Initializing payment...</span>
            </div>
          )
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 my-6 pt-4">
              {creditPackages.map((pkg) => {
                const totalCredits = getTotalCredits(pkg);
                const isSelected = selectedPackage === pkg.id;
                const meetsRequirement = !requiredCredits || totalCredits >= requiredCredits;

                return (
                  <Card
                    key={pkg.id}
                    className={`relative cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "ring-2 ring-primary shadow-lg"
                        : "hover:shadow-md hover:border-primary/50"
                    } ${
                      !meetsRequirement ? "opacity-60" : ""
                    }`}
                    onClick={() => meetsRequirement && setSelectedPackage(pkg.id)}
                    data-testid={`credit-package-${pkg.id}`}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                        <Badge className="bg-accent text-accent-foreground whitespace-nowrap">
                          <Star className="h-3 w-3 mr-1" />
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    
                    <CardHeader className="text-center pb-2">
                      <CardTitle className="flex items-center justify-center">
                        {pkg.id === "premium" ? (
                          <Crown className="text-accent mr-2 h-5 w-5" />
                        ) : (
                          <Zap className="text-primary mr-2 h-5 w-5" />
                        )}
                        {pkg.credits.toLocaleString()} Credits
                      </CardTitle>
                      {pkg.bonus && (
                        <div className="text-sm text-accent font-medium">
                          + {pkg.bonus} Bonus Credits
                        </div>
                      )}
                      <div className="text-lg font-bold text-foreground">
                        ${pkg.price}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="text-center">
                      <div className="text-sm text-muted-foreground mb-2">
                        {pkg.description}
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        Total: {totalCredits.toLocaleString()} credits
                      </div>
                      
                      {pkg.bonus && (
                        <div className="text-xs text-accent mt-1">
                          {((pkg.bonus / pkg.credits) * 100).toFixed(0)}% bonus!
                        </div>
                      )}

                      {!meetsRequirement && requiredCredits && (
                        <div className="text-xs text-destructive mt-2">
                          Need {requiredCredits - totalCredits} more credits
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <Coins className="text-accent mr-2 h-4 w-4" />
                <h4 className="font-medium">How Credits Work</h4>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Use credits to boost your videos higher on the leaderboard</li>
                <li>• Higher positions get more views and engagement</li>
                <li>• Credits are consumed when you boost a video</li>
                <li>• Earn free credits by watching and rating other demos</li>
              </ul>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={createPaymentIntentMutation.isPending}
                data-testid="button-cancel-purchase"
              >
                Cancel
              </Button>
              <Button
                onClick={() => selectedPackage && handlePackageSelect(selectedPackage)}
                disabled={!selectedPackage || createPaymentIntentMutation.isPending}
                className="flex items-center"
                data-testid="button-confirm-purchase"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {createPaymentIntentMutation.isPending ? "Initializing..." : `Purchase ${selectedPackage ? creditPackages.find(p => p.id === selectedPackage)?.credits.toLocaleString() : ""} Credits`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}