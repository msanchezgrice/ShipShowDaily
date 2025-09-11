import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Play, Pause, ExternalLink, Eye, Award, Heart } from "lucide-react";

interface VideoPlayerProps {
  video: {
    id: string;
    title: string;
    description: string;
    productUrl: string;
    videoPath: string;
    totalViews: number;
    creator: {
      id: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      profileImageUrl?: string;
    };
    todayViews: number;
  };
  onClose: () => void;
}

export default function VideoPlayer({ video, onClose }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasEarnedCredit, setHasEarnedCredit] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && (videoRef.current as any).simulationInterval) {
        clearInterval((videoRef.current as any).simulationInterval);
      }
    };
  }, []);

  const startViewingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/videos/${video.id}/start`);
    },
    onSuccess: (response: any) => {
      setSessionId(response.sessionId);
      setSessionStarted(true);
      
      // Start simulation after session is created for placeholder videos
      if (isPlaying && (!video.videoPath || video.videoPath.includes('example.com'))) {
        setTimeout(() => simulateVideoPlayback(), 100);
      }
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
      // Don't show error for "already viewed" - it's expected
      if (!error.message.includes("already viewed")) {
        toast({
          title: "Error",
          description: "Failed to start video viewing session.",
          variant: "destructive",
        });
      }
    },
  });

  const completeViewingMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return await apiRequest("POST", `/api/videos/${video.id}/complete`, { sessionId });
    },
    onSuccess: (response: any) => {
      if (response.creditAwarded) {
        setHasEarnedCredit(true);
        toast({
          title: "Credit Earned!",
          description: "You watched for 30+ seconds and earned 1 credit.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
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
      // Don't show error for session issues - they're expected for edge cases
      if (!error.message.includes("session") && !error.message.includes("already completed")) {
        toast({
          title: "Error",
          description: "Failed to complete video viewing.",
          variant: "destructive",
        });
      }
    },
  });

  const favoriteVideoMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/videos/${video.id}/favorite`);
    },
    onSuccess: () => {
      setIsFavorited(true);
      toast({
        title: "Added to Favorites",
        description: "Video added to your favorites.",
      });
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
        title: "Error",
        description: "Failed to favorite video.",
        variant: "destructive",
      });
    },
  });

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        // Clear any simulation interval first
        if ((videoRef.current as any).simulationInterval) {
          clearInterval((videoRef.current as any).simulationInterval);
        }
        setIsPlaying(false);
        
        // Only pause actual video if it has a real source
        if (video.videoPath && !video.videoPath.includes('example.com')) {
          videoRef.current.pause();
        }
      } else {
        // Start viewing session when user starts playing
        if (!sessionStarted && !startViewingMutation.isPending) {
          startViewingMutation.mutate();
        }
        
        // For placeholder videos, just set playing state (simulation starts after session creation)
        if (!video.videoPath || video.videoPath.includes('example.com')) {
          setIsPlaying(true);
        } else {
          videoRef.current.play().catch(e => {
            console.warn("Video play failed:", e);
            // Fallback to simulation mode
            setIsPlaying(true);
          });
        }
      }
    }
  };

  const simulateVideoPlayback = () => {
    if (videoRef.current && (!video.videoPath || video.videoPath.includes('example.com'))) {
      // Clear any existing interval first
      if ((videoRef.current as any).simulationInterval) {
        clearInterval((videoRef.current as any).simulationInterval);
      }
      
      // Set a fake duration for simulation
      Object.defineProperty(videoRef.current, 'duration', {
        writable: true,
        value: 60 // 60 second duration
      });
      
      let simTime = currentTime;
      
      // Simulate time updates
      const interval = setInterval(() => {
        if (isPlaying) {
          simTime += 1;
          setCurrentTime(simTime);
          
          // Trigger completion at 30 seconds
          if (simTime >= 30 && !hasEarnedCredit && sessionId && !completeViewingMutation.isPending) {
            completeViewingMutation.mutate(sessionId);
          }
          
          if (simTime >= 60) {
            clearInterval(interval);
            setIsPlaying(false);
            // Complete session on video end if not already completed
            if (!hasEarnedCredit && sessionId && !completeViewingMutation.isPending) {
              completeViewingMutation.mutate(sessionId);
            }
          }
        } else {
          clearInterval(interval);
        }
      }, 1000);
      
      // Store interval for cleanup
      (videoRef.current as any).simulationInterval = interval;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      
      // Complete session at 30 seconds if not already completed
      if (time >= 30 && !hasEarnedCredit && sessionId && !completeViewingMutation.isPending) {
        completeViewingMutation.mutate(sessionId);
      }
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    // Complete session on video end if not already completed
    if (!hasEarnedCredit && sessionId && !completeViewingMutation.isPending) {
      completeViewingMutation.mutate(sessionId);
    }
  };

  const getCreatorName = () => {
    if (video.creator.firstName && video.creator.lastName) {
      return `${video.creator.firstName} ${video.creator.lastName}`;
    }
    if (video.creator.firstName) {
      return video.creator.firstName;
    }
    return video.creator.email || "Anonymous";
  };

  const getCreatorInitial = () => {
    if (video.creator.firstName) {
      return video.creator.firstName.charAt(0).toUpperCase();
    }
    if (video.creator.email) {
      return video.creator.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const progressPercentage = videoRef.current 
    ? (currentTime / (videoRef.current.duration || 1)) * 100 
    : 0;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-hidden p-0" data-testid="video-player-modal">
        {/* Video Player Area */}
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnd}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            data-testid="video-element"
          >
            {/* For now, we'll show a placeholder since we don't have actual video files */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
              <div className="text-center text-white">
                <Play className="h-16 w-16 mb-4 mx-auto" />
                <p className="text-lg font-semibold">Demo Video Player</p>
                <p className="text-sm opacity-70">30-second minimum watch for credit</p>
              </div>
            </div>
          </video>
          
          {/* Play/Pause Overlay */}
          <div 
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={togglePlay}
          >
            {!isPlaying && (
              <div className="bg-black/50 rounded-full p-4">
                <Play className="text-white h-8 w-8" />
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div 
              ref={progressRef}
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-100"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          
          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 bg-black/50 text-white hover:bg-black/70"
            onClick={onClose}
            data-testid="button-close-video"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Credit Earned Indicator */}
          {hasEarnedCredit && (
            <Badge className="absolute top-4 left-4 bg-accent text-accent-foreground">
              <Award className="mr-1 h-3 w-3" />
              +1 Credit Earned
            </Badge>
          )}
        </div>
        
        {/* Video Info */}
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground mb-2">{video.title}</h2>
              <p className="text-muted-foreground">{video.description}</p>
            </div>
            <div className="text-right ml-4 flex flex-col items-end space-y-2">
              <Badge variant="secondary">
                <Eye className="mr-1 h-3 w-3" />
                {video.todayViews} views today
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => favoriteVideoMutation.mutate()}
                disabled={isFavorited || favoriteVideoMutation.isPending}
                className={`${isFavorited ? 'text-red-500' : 'text-gray-500 hover:text-red-500'} transition-colors`}
                data-testid="button-favorite-video"
              >
                <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
                {isFavorited ? 'Favorited' : 'Favorite'}
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={video.creator.profileImageUrl} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getCreatorInitial()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{getCreatorName()}</p>
                <p className="text-sm text-muted-foreground">Creator</p>
              </div>
            </div>
            
            <Button
              className="bg-primary text-primary-foreground"
              onClick={() => {
                // Track demo link click
                apiRequest("POST", `/api/videos/${video.id}/demo-click`).catch(console.warn);
                window.open(video.productUrl, "_blank");
              }}
              data-testid="button-try-product"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Try Product
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
