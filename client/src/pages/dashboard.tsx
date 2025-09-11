import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/Navigation";
import CreditPurchaseDialog from "@/components/CreditPurchaseDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Coins, 
  Video, 
  Eye, 
  TrendingUp, 
  Rocket, 
  Calendar,
  BarChart3,
  Upload,
  Award
} from "lucide-react";
import { useState } from "react";

export default function Dashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [boostAmount, setBoostAmount] = useState("");
  const [showCreditPurchaseDialog, setShowCreditPurchaseDialog] = useState(false);
  const [requiredCreditsForBoost, setRequiredCreditsForBoost] = useState(0);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: userVideos = [] } = useQuery<any[]>({
    queryKey: ["/api/user/videos"],
    enabled: isAuthenticated,
  });

  const { data: creditTransactions = [] } = useQuery<any[]>({
    queryKey: ["/api/credits/transactions"],
    enabled: isAuthenticated,
  });

  const boostMutation = useMutation({
    mutationFn: async ({ videoId, amount }: { videoId: string; amount: number }) => {
      return await apiRequest("POST", "/api/credits/boost", { videoId, amount });
    },
    onSuccess: () => {
      toast({
        title: "Video Boosted!",
        description: "Your video has been boosted successfully.",
      });
      setSelectedVideoId("");
      setBoostAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/transactions"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Boost Failed",
        description: "Failed to boost video. Please check your credit balance.",
        variant: "destructive",
      });
    },
  });

  const handleBoost = () => {
    const amount = parseInt(boostAmount);
    if (!selectedVideoId || !amount || amount < 10) {
      toast({
        title: "Invalid Input",
        description: "Please select a video and enter at least 10 credits.",
        variant: "destructive",
      });
      return;
    }

    if (!user || user.credits < amount) {
      setRequiredCreditsForBoost(amount);
      setShowCreditPurchaseDialog(true);
      return;
    }

    boostMutation.mutate({ videoId: selectedVideoId, amount });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  const totalViews = userVideos.reduce((sum: number, video: any) => sum + video.totalViews, 0);
  const totalTodayViews = userVideos.reduce((sum: number, video: any) => sum + video.todayViews, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your demos, track performance, and boost your videos.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Credits</p>
                  <p className="text-2xl font-bold text-accent" data-testid="text-total-credits">
                    {user?.credits || 0}
                  </p>
                </div>
                <Coins className="text-accent h-8 w-8" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Videos Uploaded</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-videos-uploaded">
                    {userVideos.length}
                  </p>
                </div>
                <Video className="text-primary h-8 w-8" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Views</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-views">
                    {totalViews.toLocaleString()}
                  </p>
                </div>
                <Eye className="text-purple-500 h-8 w-8" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Today's Views</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-today-views">
                    {totalTodayViews.toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="text-green-500 h-8 w-8" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* My Videos */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Video className="mr-2 h-5 w-5" />
                My Demo Videos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userVideos.length === 0 ? (
                  <div className="text-center py-8">
                    <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No videos uploaded yet</p>
                    <Button onClick={() => window.location.href = '/submit'} data-testid="button-upload-first">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Your First Demo
                    </Button>
                  </div>
                ) : (
                  userVideos.map((video: any) => (
                    <div key={video.id} className="bg-secondary rounded-lg p-4" data-testid={`video-card-${video.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-primary/20 rounded-lg flex items-center justify-center">
                            <Video className="text-primary h-6 w-6" />
                          </div>
                          <div>
                            <h4 className="font-medium text-foreground">{video.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {new Date(video.createdAt).toLocaleDateString()}
                            </p>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-sm text-muted-foreground">
                                <Eye className="inline h-3 w-3 mr-1" />
                                {video.totalViews} total views
                              </span>
                              <Badge variant="secondary">
                                {video.todayViews} today
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Button
                            size="sm"
                            className="bg-primary text-primary-foreground"
                            onClick={() => {
                              setSelectedVideoId(video.id);
                              setBoostAmount("50");
                            }}
                            data-testid={`button-boost-${video.id}`}
                          >
                            <Rocket className="mr-2 h-3 w-3" />
                            Boost
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Credit Management */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Coins className="mr-2 h-5 w-5" />
                Credit Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Available Credits */}
                <div className="bg-secondary rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-foreground font-medium">Available Credits</p>
                      <p className="text-3xl font-bold text-accent">{user?.credits || 0}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-sm">Total Earned</p>
                      <p className="text-xl font-semibold text-foreground">
                        {user?.totalCreditsEarned || 0}
                      </p>
                    </div>
                  </div>

                  {/* Boost Controls */}
                  <div className="border-t border-border pt-4 space-y-4">
                    <div>
                      <label className="text-foreground font-medium block mb-2">Boost Video:</label>
                      <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
                        <SelectTrigger data-testid="select-video">
                          <SelectValue placeholder="Select a video" />
                        </SelectTrigger>
                        <SelectContent>
                          {userVideos.map((video: any) => (
                            <SelectItem key={video.id} value={video.id}>
                              {video.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-foreground font-medium block mb-2">Credits to Spend:</label>
                      <Input
                        type="number"
                        placeholder="50"
                        min="10"
                        max={user?.credits || 0}
                        value={boostAmount}
                        onChange={(e) => setBoostAmount(e.target.value)}
                        data-testid="input-boost-amount"
                      />
                    </div>
                    
                    <Button
                      className="w-full bg-accent text-accent-foreground"
                      onClick={handleBoost}
                      disabled={boostMutation.isPending || !selectedVideoId || !boostAmount || parseInt(boostAmount) < 10}
                      data-testid="button-boost-video"
                    >
                      {boostMutation.isPending ? (
                        "Boosting..."
                      ) : (
                        <>
                          <Rocket className="mr-2 h-4 w-4" />
                          Boost Video
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div>
                  <h4 className="text-foreground font-medium mb-3">Recent Transactions</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {creditTransactions.slice(0, 10).map((transaction: any) => (
                      <div key={transaction.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          {transaction.type === 'earned' ? (
                            <Award className="h-3 w-3 text-green-500" />
                          ) : (
                            <Rocket className="h-3 w-3 text-orange-500" />
                          )}
                          <span className="text-muted-foreground">{transaction.reason}</span>
                        </div>
                        <span className={`font-medium ${
                          transaction.type === 'earned' ? 'text-green-500' : 'text-orange-500'
                        }`}>
                          {transaction.type === 'earned' ? '+' : '-'}{transaction.amount}
                        </span>
                      </div>
                    ))}
                    {creditTransactions.length === 0 && (
                      <p className="text-muted-foreground text-sm">No transactions yet</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Credit Purchase Dialog */}
      <CreditPurchaseDialog
        isOpen={showCreditPurchaseDialog}
        onClose={() => setShowCreditPurchaseDialog(false)}
        requiredCredits={requiredCreditsForBoost}
        onPurchaseSuccess={() => {
          // Refresh user data and try the boost again
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          toast({
            title: "Credits purchased!",
            description: "You can now boost your video.",
          });
        }}
      />
    </div>
  );
}
