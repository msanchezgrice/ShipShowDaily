import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError, redirectToSignInClient } from "@/lib/authUtils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Play, Pause, ExternalLink, Eye, Award, Heart, Loader2 } from "lucide-react";
import Hls from "hls.js";

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
    // Cloudflare Stream fields
    provider?: 'stream' | 's3';
    hls_url?: string;
    thumbnailPath?: string;
    duration_s?: number;
    // Favorite status
    isFavorited?: boolean;
  };
  onClose: () => void;
}

export default function VideoPlayerEnhanced({ video, onClose }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasEarnedCredit, setHasEarnedCredit] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isFavorited, setIsFavorited] = useState(video.isFavorited || false);
  const [buffering, setBuffering] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize HLS.js for Stream videos
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const setupVideo = () => {
      // Check if this is a Cloudflare Stream video
      const isStreamVideo = video.provider === 'stream' && video.hls_url;
      
      if (isStreamVideo && video.hls_url) {
        // Use HLS.js for Stream videos
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            maxBufferSize: 60 * 1000 * 1000, // 60 MB
            maxBufferHole: 0.5,
            startLevel: -1, // Auto quality
            autoStartLoad: true,
            startPosition: -1,
            debug: false,
          });

          hls.loadSource(video.hls_url);
          hls.attachMedia(videoElement);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('HLS manifest loaded');
            setIsLoading(false);
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error('HLS fatal error:', data);
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.log('Fatal network error, trying to recover');
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.log('Fatal media error, trying to recover');
                  hls.recoverMediaError();
                  break;
                default:
                  console.error('Unrecoverable error');
                  hls.destroy();
                  setIsLoading(false);
                  toast({
                    title: "Playback Error",
                    description: "Failed to load video. Please try again.",
                    variant: "destructive",
                  });
                  break;
              }
            }
          });

          hls.on(Hls.Events.FRAG_BUFFERED, () => {
            setBuffering(false);
          });

          hls.on(Hls.Events.FRAG_LOADING, () => {
            setBuffering(true);
          });

          hlsRef.current = hls;
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari/iOS)
          videoElement.src = video.hls_url;
          setIsLoading(false);
        } else {
          console.error('HLS not supported');
          toast({
            title: "Browser not supported",
            description: "Your browser doesn't support video streaming. Please try Chrome, Firefox, or Safari.",
            variant: "destructive",
          });
        }
      } else {
        // Use direct video source for S3 videos
        videoElement.src = video.videoPath;
        setIsLoading(false);
      }
    };

    setupVideo();

    // Cleanup
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if ((videoRef.current as any)?.simulationInterval) {
        clearInterval((videoRef.current as any).simulationInterval);
      }
    };
  }, [video.provider, video.hls_url, video.videoPath, toast]);

  // Start viewing session
  const startViewingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/videos/${video.id}/start`, {
        method: "POST",
      });
      return response.sessionId;
    },
    onSuccess: (newSessionId) => {
      setSessionId(newSessionId);
      setSessionStarted(true);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Authentication required",
          description: "Please sign in to track your viewing progress.",
          variant: "destructive",
        });
        setTimeout(() => redirectToSignInClient(), 500);
      }
    },
  });

  // Complete viewing session
  const completeViewingMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("No session to complete");
      return apiRequest(`/api/videos/${video.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
    },
    onSuccess: (data) => {
      if (data.creditAwarded && !hasEarnedCredit) {
        setHasEarnedCredit(true);
        toast({
          title: "Credit Earned! 🎉",
          description: "You earned 1 credit for watching this demo.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
    },
    onError: (error: any) => {
      if (!isUnauthorizedError(error)) {
        console.error("Failed to complete viewing session:", error);
      }
    },
  });

  // Favorite video
  const favoriteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/videos/${video.id}/favorite`, {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      const newFavorited = data.favorited;
      setIsFavorited(newFavorited);
      toast({
        title: newFavorited ? "Added to favorites" : "Removed from favorites",
        description: newFavorited
          ? "Video added to your favorites"
          : "Video removed from your favorites",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Authentication required",
          description: "Please sign in to favorite videos.",
          variant: "destructive",
        });
        setTimeout(() => redirectToSignInClient(), 500);
      } else {
        toast({
          title: "Error",
          description: "Failed to update favorite status",
          variant: "destructive",
        });
      }
    },
  });

  // Track demo link click
  const trackDemoClickMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/videos/${video.id}/demo-click`, {
        method: "POST",
      });
    },
  });

  // Handle play/pause
  const togglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch((error) => {
        console.error("Playback failed:", error);
        toast({
          title: "Playback Error",
          description: "Failed to play video. Please try again.",
          variant: "destructive",
        });
      });
    }
  };

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      if (!sessionStarted) {
        startViewingMutation.mutate();
      }
    };

    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // Update progress bar
      if (progressRef.current) {
        const progress = (video.currentTime / video.duration) * 100;
        progressRef.current.style.width = `${progress}%`;
      }

      // Check if user has watched minimum duration (30 seconds or 80% of video)
      const watchedEnough = 
        video.currentTime >= 30 || 
        video.currentTime >= video.duration * 0.8;

      if (watchedEnough && sessionId && !hasEarnedCredit) {
        completeViewingMutation.mutate();
      }
    };

    const handleWaiting = () => setBuffering(true);
    const handlePlaying = () => setBuffering(false);
    const handleCanPlay = () => {
      setIsLoading(false);
      setBuffering(false);
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("canplay", handleCanPlay);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [sessionStarted, sessionId, hasEarnedCredit]);

  // Handle demo link click
  const handleDemoClick = () => {
    trackDemoClickMutation.mutate();
    window.open(video.productUrl, "_blank");
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get creator display name
  const creatorName = video.creator.firstName && video.creator.lastName
    ? `${video.creator.firstName} ${video.creator.lastName}`
    : video.creator.email || "Anonymous";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
        <div className="relative">
          {/* Close button */}
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Video container */}
          <div className="relative bg-black aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full"
              onClick={togglePlayPause}
              poster={video.thumbnailPath}
              playsInline
              preload="metadata"
              crossOrigin="anonymous"
            />

            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="h-12 w-12 text-white animate-spin" />
              </div>
            )}

            {/* Buffering indicator */}
            {buffering && !isLoading && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Loader2 className="h-8 w-8 text-white/80 animate-spin" />
              </div>
            )}

            {/* Play/Pause overlay */}
            {!isLoading && (
              <div
                className="absolute inset-0 flex items-center justify-center cursor-pointer group"
                onClick={togglePlayPause}
              >
                <div className="bg-black/50 rounded-full p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isPlaying ? (
                    <Pause className="h-12 w-12 text-white" />
                  ) : (
                    <Play className="h-12 w-12 text-white" />
                  )}
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div
                ref={progressRef}
                className="h-full bg-blue-500 transition-all duration-100"
                style={{ width: "0%" }}
              />
            </div>

            {/* Time display */}
            <div className="absolute bottom-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
              {formatTime(currentTime)} / {formatTime(duration || video.duration_s || 0)}
            </div>

            {/* Credit indicator */}
            {hasEarnedCredit && (
              <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-full text-sm flex items-center">
                <Award className="h-4 w-4 mr-1" />
                +1 Credit
              </div>
            )}
          </div>

          {/* Video info */}
          <div className="p-6 bg-card text-card-foreground">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">{video?.title || 'Untitled'}</h2>
                <p className="text-muted-foreground mb-4">{video.description}</p>
              </div>
              <Button
                onClick={() => favoriteMutation.mutate()}
                variant="ghost"
                size="icon"
                className="ml-4"
              >
                <Heart
                  className={`h-5 w-5 ${
                    isFavorited ? "fill-red-500 text-red-500" : ""
                  }`}
                />
              </Button>
            </div>

            {/* Creator info */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Avatar className="h-10 w-10 mr-3">
                  <AvatarImage src={video.creator.profileImageUrl} />
                  <AvatarFallback>
                    {creatorName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{creatorName}</p>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Eye className="h-3 w-3 mr-1" />
                    {video.totalViews} total views • {video.todayViews} today
                  </div>
                </div>
              </div>
              
              {/* Provider badge */}
              {video.provider === 'stream' && (
                <Badge variant="secondary" className="ml-2">
                  HD Stream
                </Badge>
              )}
            </div>

            {/* Demo link */}
            <Button
              onClick={handleDemoClick}
              className="w-full"
              size="lg"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Try the Product
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
