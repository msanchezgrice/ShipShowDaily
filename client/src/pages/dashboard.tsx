import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/Navigation";
import CreditPurchaseDialog from "@/components/CreditPurchaseDialog";
import InsufficientCreditsDialog from "@/components/InsufficientCreditsDialog";
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
  Award,
  Play,
  ExternalLink,
  Trash2,
  Heart,
  Share2,
  MousePointerClick,
  Activity
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [boostAmount, setBoostAmount] = useState("");
  const [showCreditPurchaseDialog, setShowCreditPurchaseDialog] = useState(false);
  const [showInsufficientCreditsDialog, setShowInsufficientCreditsDialog] = useState(false);
  const [requiredCreditsForBoost, setRequiredCreditsForBoost] = useState(0);
  const [, navigate] = useLocation();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to access the dashboard",
        variant: "destructive",
      });
      setTimeout(() => navigate("/"), 1000);
      return;
    }
  }, [isAuthenticated, isLoading, toast, navigate]);

  const { data: userVideos = [], refetch: refetchVideos } = useQuery<any[]>({
    queryKey: ["/api/user/videos"],
    enabled: isAuthenticated,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: creditTransactions = [] } = useQuery<any[]>({
    queryKey: ["/api/credits/transactions"],
    enabled: isAuthenticated,
  });

  const { data: analytics } = useQuery<any>({
    queryKey: ["/api/user/analytics"],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30 seconds
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
        setTimeout(() => navigate("/"), 500);
        return;
      }
      toast({
        title: "Boost Failed",
        description: "Failed to boost video. Please check your credit balance.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (videoId: string) => {
      return await apiRequest("DELETE", `/api/videos/${videoId}/delete`);
    },
    onSuccess: () => {
      toast({
        title: "Video Deleted",
        description: "Your video has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/videos"] });
      refetchVideos();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => navigate("/"), 500);
        return;
      }
      toast({
        title: "Delete Failed",
        description: "Failed to delete video. Please try again.",
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
      setShowInsufficientCreditsDialog(true);
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

        {/* Stats Overview - 2 rows of stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
          <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs">Credits</p>
                  <p className="text-lg md:text-xl font-bold text-accent" data-testid="text-total-credits">
                    {user?.credits || 0}
                  </p>
                </div>
                <Coins className="text-accent h-5 w-5 md:h-6 md:w-6" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs">Videos</p>
                  <p className="text-lg md:text-xl font-bold text-foreground" data-testid="text-videos-uploaded">
                    {userVideos.length}
                  </p>
                </div>
                <Video className="text-primary h-5 w-5 md:h-6 md:w-6" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs">Total Views</p>
                  <p className="text-lg md:text-xl font-bold text-foreground" data-testid="text-total-views">
                    {(analytics?.overview?.totalViews || totalViews).toLocaleString()}
                  </p>
                </div>
                <Eye className="text-purple-500 h-5 w-5 md:h-6 md:w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs">Today</p>
                  <p className="text-lg md:text-xl font-bold text-foreground" data-testid="text-today-views">
                    {totalTodayViews.toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="text-green-500 h-5 w-5 md:h-6 md:w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second row of stats */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs">Favorites</p>
                  <p className="text-lg md:text-xl font-bold text-foreground">
                    {(analytics?.overview?.totalFavorites || 0).toLocaleString()}
                  </p>
                </div>
                <Heart className="text-red-500 h-5 w-5 md:h-6 md:w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs">Demo Clicks</p>
                  <p className="text-lg md:text-xl font-bold text-foreground">
                    {(analytics?.overview?.totalDemoClicks || 0).toLocaleString()}
                  </p>
                </div>
                <MousePointerClick className="text-blue-500 h-5 w-5 md:h-6 md:w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs">Shares</p>
                  <p className="text-lg md:text-xl font-bold text-foreground">
                    {(analytics?.overview?.totalShares || 0).toLocaleString()}
                  </p>
                </div>
                <Share2 className="text-orange-500 h-5 w-5 md:h-6 md:w-6" />
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
                    <Button onClick={() => window.location.href = '/submit-demo'} data-testid="button-upload-first">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Your First Demo
                    </Button>
                  </div>
                ) : (
                  userVideos.map((video: any) => (
                    <div key={video.id} className="bg-secondary rounded-lg p-4 hover:bg-secondary/80 transition-colors" data-testid={`video-card-${video.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="relative w-20 h-20 bg-primary/20 rounded-lg flex items-center justify-center overflow-hidden cursor-pointer group" 
                               onClick={() => window.open(video.productUrl, '_blank')}>
                            {video.thumbnailPath ? (
                              <>
                                <img 
                                  src={video.thumbnailPath} 
                                  alt={video.title}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Play className="text-white h-8 w-8" />
                                </div>
                              </>
                            ) : (
                              <Video className="text-primary h-6 w-6" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-foreground hover:text-primary cursor-pointer" 
                                onClick={() => window.open(video.productUrl, '_blank')}>
                              {video.title}
                            </h4>
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
                              {video.status === 'processing' && (
                                <Badge variant="outline" className="text-yellow-600">
                                  Processing...
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {video.status === 'ready' && video.videoPath && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`/watch/${video.id}`, '_blank')}
                              data-testid={`button-watch-${video.id}`}
                            >
                              <Play className="mr-2 h-3 w-3" />
                              Watch
                            </Button>
                          )}
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                data-testid={`button-delete-${video.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Video</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{video.title}"? This action cannot be undone.
                                  All views, favorites, and stats will be permanently removed.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(video.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

      {/* Insufficient Credits Dialog */}
      <InsufficientCreditsDialog
        isOpen={showInsufficientCreditsDialog}
        onClose={() => setShowInsufficientCreditsDialog(false)}
        requiredCredits={requiredCreditsForBoost}
        currentCredits={user?.credits || 0}
      />
      
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
