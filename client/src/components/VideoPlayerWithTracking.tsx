import { useRef, useState, useEffect } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import Hls from "hls.js";
import { useUser, useAuth } from "@clerk/clerk-react";

interface VideoPlayerWithTrackingProps {
  src: string;
  poster?: string;
  className?: string;
  videoId?: string;
  onViewStart?: () => void;
  onViewComplete?: () => void;
}

export default function VideoPlayerWithTracking({
  src,
  poster,
  className = "",
  videoId,
  onViewStart,
  onViewComplete
}: VideoPlayerWithTrackingProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [hasStartedTracking, setHasStartedTracking] = useState(false);
  const viewDurationRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();

  // Start viewing session when video starts playing
  const startViewTracking = async () => {
    if (!videoId || !isSignedIn || hasStartedTracking) {
      console.log('Skipping view tracking:', { videoId, isSignedIn, hasStartedTracking });
      return;
    }

    try {
      console.log(`Starting view tracking for video ${videoId}`);
      const token = await getToken({ template: "__session" });

      const response = await fetch(`/api/videos/${videoId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('View tracking started:', data);
        setViewingSessionId(data.sessionId);
        setHasStartedTracking(true);
        lastUpdateRef.current = Date.now();
        onViewStart?.();
      } else {
        const errorText = await response.text();
        console.error('Failed to start view tracking:', response.status, errorText);
      }
    } catch (error) {
      console.error("Failed to start view tracking:", error);
    }
  };

  // Complete viewing session
  const completeViewTracking = async () => {
    if (!viewingSessionId || !videoId || !isSignedIn) {
      console.log('Skipping view complete:', { viewingSessionId, videoId, isSignedIn });
      return;
    }

    try {
      console.log(`Completing view tracking for video ${videoId}, session ${viewingSessionId}`);
      const token = await getToken({ template: "__session" });

      const response = await fetch(`/api/videos/${videoId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ sessionId: viewingSessionId }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('View tracking completed:', data);
        onViewComplete?.();
        if (data.creditAwarded) {
          console.log("Credit earned for watching!");
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to complete view tracking:', response.status, errorText);
      }
    } catch (error) {
      console.error("Failed to complete view tracking:", error);
    }
  };

  // Track watch duration
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPlaying && hasStartedTracking) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastUpdateRef.current) / 1000;
        viewDurationRef.current += elapsed;
        lastUpdateRef.current = now;

        // Complete session after minimum watch time (10 seconds)
        if (viewDurationRef.current >= 10 && viewingSessionId) {
          completeViewTracking();
          clearInterval(interval);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, hasStartedTracking, viewingSessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewingSessionId && viewDurationRef.current >= 10) {
        completeViewTracking();
      }
    };
  }, [viewingSessionId]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !src) return;

    const setupVideo = () => {
      // Check if this is an HLS stream
      const isHLS = src.includes('.m3u8') || src.includes('stream.cloudflare.com');

      if (isHLS) {
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

          hls.loadSource(src);
          hls.attachMedia(videoElement);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
            setError(null);
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
                  setError("Failed to load video. Please try again.");
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
          videoElement.src = src;
          setIsLoading(false);
        } else {
          setError("Your browser doesn't support video streaming.");
        }
      } else {
        // Use direct video source
        videoElement.src = src;
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
    };
  }, [src]);

  const togglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch((error) => {
        console.error("Playback failed:", error);
        setError("Failed to play video. Please try again.");
      });
    }
  };

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      if (!hasStartedTracking) {
        startViewTracking();
      }
    };
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => setIsLoading(false);
    const handleWaiting = () => setBuffering(true);
    const handlePlaying = () => setBuffering(false);
    const handleCanPlay = () => {
      setIsLoading(false);
      setBuffering(false);
    };
    const handleError = () => {
      setIsLoading(false);
      setError("Failed to load video.");
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
    };
  }, [hasStartedTracking]);

  if (error) {
    return (
      <div className={`bg-secondary rounded-lg aspect-video flex items-center justify-center ${className}`}>
        <p className="text-muted-foreground text-center px-4">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden aspect-video ${className}`}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        poster={poster}
        playsInline
        preload="metadata"
        controls={false}
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
          <div className={`bg-black/50 rounded-full p-4 transition-opacity ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
            {isPlaying ? (
              <Pause className="h-12 w-12 text-white" />
            ) : (
              <Play className="h-12 w-12 text-white" />
            )}
          </div>
        </div>
      )}

      {/* Basic controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlayPause}
            className="text-white hover:text-white/80 transition-colors"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}