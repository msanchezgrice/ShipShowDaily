import { useState } from "react";
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
import { Coins, CreditCard, Zap, Crown, Star } from "lucide-react";

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

export default function CreditPurchaseDialog({
  isOpen,
  onClose,
  requiredCredits,
  onPurchaseSuccess
}: CreditPurchaseDialogProps) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const purchaseMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Purchase failed" }));
        throw new Error(errorData.message);
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Credits purchased!",
        description: `Successfully added ${data.credits} credits to your account.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onPurchaseSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Purchase failed",
        description: error.message || "Failed to purchase credits. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePurchase = () => {
    if (!selectedPackage) return;
    purchaseMutation.mutate(selectedPackage);
  };

  const getTotalCredits = (pkg: CreditPackage) => {
    return pkg.credits + (pkg.bonus || 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <Coins className="text-primary mr-2 h-6 w-6" />
            Purchase Credits
          </DialogTitle>
          <DialogDescription>
            {requiredCredits ? (
              <>You need <strong>{requiredCredits} credits</strong> to boost this video. Choose a credit package below to continue.</>
            ) : (
              <>Choose a credit package to boost your videos and increase their visibility on the leaderboard.</>
            )}
          </DialogDescription>
        </DialogHeader>

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
            onClick={onClose}
            disabled={purchaseMutation.isPending}
            data-testid="button-cancel-purchase"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={!selectedPackage || purchaseMutation.isPending}
            className="flex items-center"
            data-testid="button-confirm-purchase"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            {purchaseMutation.isPending ? "Processing..." : `Purchase ${selectedPackage ? creditPackages.find(p => p.id === selectedPackage)?.credits.toLocaleString() : ""} Credits`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}