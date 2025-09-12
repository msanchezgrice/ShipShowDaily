import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useViewingSession } from "@/hooks/useViewingSession";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Heart, 
  Volume2, 
  VolumeX, 
  ExternalLink, 
  Hash, 
  Eye, 
  User,
  Coins,
  Award,
  Play,
  Pause,
  X
} from "lucide-react";

interface FeedVideo {
  video: {
    id: string;
    title: string;
    description: string;
    productUrl: string;
    videoPath: string;
    totalViews: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  creator: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImageUrl?: string;
    credits: number;
  };
  tags: Array<{ id: string; name: string }>;
  todayViews: number;
  totalViews: number;
  isFavorited: boolean;
  boostAmount: number;
}

// Single video component to encapsulate viewing logic
function FeedVideoItem({ 
  item, 
  currentIndex,
  index, 
  isActive,
  isMuted,
  onToggleMute,
  onNavigateNext
}: {
  item: FeedVideo;
  currentIndex: number;
  index: number;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onNavigateNext: () => void;
}) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const { 
    progress, 
    creditEarned, 
    startSession,
    reset,
    isStarting
  } = useViewingSession({
    videoId: item.video.id,
    enabled: isActive && isPlaying
  });

  // Favorite video mutation
  const favoriteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/videos/${item.video.id}/favorite`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to favorites",
        description: "This demo has been added to your favorites",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });

  // Demo link click mutation
  const demoClickMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/videos/${item.video.id}/demo-click`);
      return response.json();
    },
  });

  // Handle video play/pause based on active state
  useEffect(() => {
    if (!videoRef.current) return;

    const playVideo = async () => {
      try {
        await videoRef.current!.play();
        setIsPlaying(true);
      } catch (error) {
        setIsPlaying(false);
        // Try playing with muted attribute set
        if (videoRef.current) {
          videoRef.current.muted = true;
          try {
            await videoRef.current.play();
            setIsPlaying(true);
          } catch (secondError) {
            console.error(`Failed to play video even when muted:`, secondError);
          }
        }
      }
    };

    if (isActive) {
      // Start playing when video becomes active
      playVideo();
      
      // Start viewing session if not already started
      if (!hasInitialized && !isStarting && !creditEarned) {
        startSession();
        setHasInitialized(true);
      }
    } else {
      // Pause when video is not active
      videoRef.current.pause();
      setIsPlaying(false);
      // Reset session when video becomes inactive
      if (hasInitialized) {
        reset();
        setHasInitialized(false);
      }
    }
  }, [isActive, hasInitialized, startSession, reset, isStarting, creditEarned]);

  // Preload video when it's close to being viewed
  useEffect(() => {
    if (!videoRef.current) return;
    
    // Calculate relative position from current index
    const relativeIndex = index - currentIndex;
    
    // Preload next video
    if (relativeIndex === 1) {
      videoRef.current.preload = "auto";
    } else if (Math.abs(relativeIndex) <= 2) {
      // Keep metadata for nearby videos
      videoRef.current.preload = "metadata";
    } else {
      // Don't preload far away videos
      videoRef.current.preload = "none";
    }
  }, [index, currentIndex]);

  const handleTryProduct = () => {
    // Show confirmation for external links
    const shouldOpen = window.confirm(
      `You're about to open an external link:\n${item.video.productUrl}\n\nContinue?`
    );
    
    if (shouldOpen) {
      demoClickMutation.mutate();
      window.open(item.video.productUrl, "_blank", "noopener,noreferrer");
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  const handleVideoEnded = () => {
    // Auto-advance to next video when current ends
    onNavigateNext();
  };

  return (
    <div 
      className="h-screen snap-start relative bg-black flex items-center justify-center"
      data-testid={`feed-item-${item.video.id}`}
    >
      {/* Progress Bar */}
      {progress > 0 && (
        <div className="absolute top-0 left-0 right-0 z-20 p-2">
          <Progress 
            value={progress} 
            className="h-1"
            data-testid={`progress-${item.video.id}`}
          />
          {creditEarned && (
            <div className="flex items-center justify-center mt-2">
              <Badge className="bg-green-500 text-white">
                <Award className="h-3 w-3 mr-1" />
                Credit Earned!
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Video */}
      <video
        ref={videoRef}
        src={item.video.videoPath}
        className="absolute inset-0 w-full h-full object-contain cursor-pointer"
        muted={isMuted}
        playsInline
        autoPlay={isActive}
        loop={false}
        data-testid={`video-${item.video.id}`}
        onClick={togglePlayPause}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleVideoEnded}
      />

      {/* Play/Pause Overlay */}
      {!isPlaying && isActive && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="bg-black/50 rounded-full p-4">
            <Play className="text-white h-12 w-12" />
          </div>
        </div>
      )}

      {/* Left Bottom Overlay - Video Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-20 bg-gradient-to-t from-black/80 to-transparent">
        <div className="max-w-md">
          {/* Creator Info */}
          <div className="flex items-center mb-3">
            <Avatar className="h-10 w-10 mr-3">
              <AvatarImage src={item.creator.profileImageUrl} />
              <AvatarFallback>
                <User className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-white font-semibold" data-testid={`creator-name-${item.video.id}`}>
                {item.creator.firstName || item.creator.email?.split("@")[0] || "Anonymous"}
              </p>
              <p className="text-white/70 text-sm flex items-center">
                <Eye className="h-3 w-3 mr-1" />
                {item.todayViews} views today
              </p>
            </div>
          </div>

          {/* Title & Description */}
          <h3 className="text-white text-xl font-bold mb-2" data-testid={`title-${item.video.id}`}>
            {item.video.title}
          </h3>
          <p className="text-white/90 text-sm mb-3 line-clamp-2" data-testid={`description-${item.video.id}`}>
            {item.video.description}
          </p>

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {item.tags.map(tag => (
                <Badge 
                  key={tag.id} 
                  variant="secondary" 
                  className="bg-white/20 text-white border-white/30 backdrop-blur-sm"
                  data-testid={`tag-${tag.name}-${item.video.id}`}
                >
                  <Hash className="h-3 w-3 mr-1" />
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-32 flex flex-col gap-4">
        {/* Favorite */}
        <Button
          size="icon"
          variant="ghost"
          className={`h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 ${
            item.isFavorited ? "text-red-500" : "text-white"
          }`}
          onClick={() => !item.isFavorited && favoriteMutation.mutate()}
          disabled={item.isFavorited || favoriteMutation.isPending}
          data-testid={`button-favorite-${item.video.id}`}
        >
          <Heart className={`h-6 w-6 ${item.isFavorited ? "fill-current" : ""}`} />
        </Button>

        {/* Mute/Unmute */}
        <Button
          size="icon"
          variant="ghost"
          className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white"
          onClick={onToggleMute}
          data-testid={`button-mute-${item.video.id}`}
        >
          {isMuted ? (
            <VolumeX className="h-6 w-6" />
          ) : (
            <Volume2 className="h-6 w-6" />
          )}
        </Button>

        {/* Try Product */}
        <Button
          size="icon"
          variant="ghost"
          className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white"
          onClick={handleTryProduct}
          data-testid={`button-try-product-${item.video.id}`}
        >
          <ExternalLink className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(() => {
    // Load mute state from localStorage, default to true for autoplay
    const savedMute = localStorage.getItem('feedMuted');
    return savedMute !== null ? savedMute === 'true' : true;
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const videoElementsRef = useRef<Map<string, HTMLElement>>(new Map());

  const { data: feedVideos = [], isLoading } = useQuery<FeedVideo[]>({
    queryKey: ["/api/feed"],
    queryFn: async () => {
      const response = await fetch("/api/feed?limit=10");
      if (!response.ok) throw new Error("Failed to fetch feed");
      return response.json();
    },
  });

  // Setup IntersectionObserver for better performance
  useEffect(() => {
    if (!containerRef.current || feedVideos.length === 0) return;

    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.75) {
            // Find index of the intersecting video
            const videoId = entry.target.getAttribute('data-video-id');
            const index = feedVideos.findIndex(v => v.video.id === videoId);
            if (index !== -1 && index !== currentIndex) {
              setCurrentIndex(index);
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.75,
        rootMargin: '0px'
      }
    );

    // Observe all video elements
    videoElementsRef.current.forEach((element) => {
      observerRef.current?.observe(element);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [feedVideos, currentIndex]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const navigateToNext = useCallback(() => {
    if (currentIndex < feedVideos.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollToVideo(nextIndex);
    }
  }, [currentIndex, feedVideos.length]);

  const navigateToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      scrollToVideo(prevIndex);
    }
  }, [currentIndex]);

  const scrollToVideo = (index: number) => {
    if (!containerRef.current || !feedVideos[index]) return;
    
    const videoElement = videoElementsRef.current.get(feedVideos[index].video.id);
    if (videoElement) {
      videoElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const registerVideoElement = useCallback((videoId: string, element: HTMLElement | null) => {
    if (element) {
      videoElementsRef.current.set(videoId, element);
    } else {
      videoElementsRef.current.delete(videoId);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch(e.key) {
        case 'ArrowUp':
          e.preventDefault();
          navigateToPrevious();
          break;
        case 'ArrowDown':
          e.preventDefault();
          navigateToNext();
          break;
        case ' ':
          e.preventDefault();
          // Space handled by individual video components
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, feedVideos.length, navigateToPrevious, navigateToNext, toggleMute]);

  // Save mute state to localStorage
  useEffect(() => {
    localStorage.setItem('feedMuted', isMuted.toString());
  }, [isMuted]);

  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-md px-4">
          <Skeleton className="h-12 w-48 mx-auto mb-4" />
          <Skeleton className="h-64 w-full mb-4" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (feedVideos.length === 0) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <h2 className="text-2xl font-bold mb-4">No Demos Available</h2>
          <p className="text-muted-foreground mb-6">Be the first to submit a demo!</p>
          <Button 
            onClick={() => window.location.href = "/submit-demo"}
            data-testid="button-submit-first-demo"
          >
            Submit Your Demo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="h-screen overflow-y-scroll snap-y snap-mandatory relative"
      style={{ scrollBehavior: "smooth" }}
      data-testid="feed-container"
    >
      {/* Exit Button */}
      <button
        onClick={() => window.location.href = '/'}
        className="fixed top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors backdrop-blur-sm"
        data-testid="button-exit-feed"
        aria-label="Exit to Leaderboard"
      >
        <X className="h-6 w-6" />
      </button>
      {feedVideos.map((item, index) => (
        <div
          key={item.video.id}
          ref={(el) => registerVideoElement(item.video.id, el)}
          data-video-id={item.video.id}
        >
          <FeedVideoItem
            item={item}
            currentIndex={currentIndex}
            index={index}
            isActive={index === currentIndex}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            onNavigateNext={navigateToNext}
          />
        </div>
      ))}
    </div>
  );
}