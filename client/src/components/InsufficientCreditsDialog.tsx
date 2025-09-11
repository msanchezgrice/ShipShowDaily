import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, Coins, Play, ShoppingCart, X } from "lucide-react";
import CreditPurchaseDialog from "./CreditPurchaseDialog";

interface InsufficientCreditsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  requiredCredits: number;
  currentCredits: number;
}

export default function InsufficientCreditsDialog({
  isOpen,
  onClose,
  requiredCredits,
  currentCredits
}: InsufficientCreditsDialogProps) {
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const { toast } = useToast();

  const creditsNeeded = requiredCredits - currentCredits;

  const handleWatchDemos = () => {
    onClose();
    window.location.href = '/';
    toast({
      title: "Start watching demos!",
      description: "Watch videos for 30+ seconds each to earn credits.",
    });
  };

  const handleBuyCredits = () => {
    setShowPurchaseDialog(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Coins className="mr-2 h-5 w-5 text-accent" />
              Need More Credits
            </DialogTitle>
            <DialogDescription>
              You need {creditsNeeded} more credits to boost this video.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center py-2">
              <div className="text-sm text-muted-foreground mb-2">
                Your credits: <span className="text-foreground font-medium">{currentCredits}</span>
              </div>
              <div className="text-sm text-muted-foreground mb-2">
                Required: <span className="text-foreground font-medium">{requiredCredits}</span>
              </div>
              <div className="text-sm text-accent font-medium">
                Need: {creditsNeeded} more credits
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Watch Demos Option */}
              <Card className="border-primary/20 hover:border-primary/40 transition-colors cursor-pointer" onClick={handleWatchDemos} data-testid="card-watch-demos">
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-primary/10 rounded-lg mr-3">
                      <Play className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">Watch More Demos</h3>
                      <p className="text-sm text-muted-foreground">Earn 1 credit per 30+ second view</p>
                      <p className="text-xs text-primary mt-1">FREE • Watch {creditsNeeded} videos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Buy Credits Option */}
              <Card className="border-accent/20 hover:border-accent/40 transition-colors cursor-pointer" onClick={handleBuyCredits} data-testid="card-buy-credits">
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-accent/10 rounded-lg mr-3">
                      <ShoppingCart className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">Buy Credits</h3>
                      <p className="text-sm text-muted-foreground">Instant credits with bonus packages</p>
                      <p className="text-xs text-accent mt-1">Starting at $5 • 100+ credits</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="ghost" onClick={onClose} data-testid="button-cancel-boost">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreditPurchaseDialog
        isOpen={showPurchaseDialog}
        onClose={() => setShowPurchaseDialog(false)}
        requiredCredits={requiredCredits}
        onPurchaseSuccess={() => {
          setShowPurchaseDialog(false);
          onClose();
          toast({
            title: "Credits purchased!",
            description: "You can now boost your video.",
          });
        }}
      />
    </>
  );
}