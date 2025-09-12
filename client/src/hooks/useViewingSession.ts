import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UseViewingSessionOptions {
  videoId: string;
  onCreditEarned?: () => void;
  enabled?: boolean;
}

export function useViewingSession({ videoId, onCreditEarned, enabled = true }: UseViewingSessionOptions) {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [creditEarned, setCreditEarned] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Start viewing session mutation
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/videos/${videoId}/start`);
      return response.json();
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      startProgressTracking();
    },
  });

  // Complete viewing session mutation
  const completeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest("POST", `/api/videos/${videoId}/complete`, { sessionId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.creditAwarded && !creditEarned) {
        setCreditEarned(true);
        toast({
          title: "Credit Earned! 🎉",
          description: "You earned 1 credit for watching this demo",
          className: "bg-green-500 text-white",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        onCreditEarned?.();
      }
    },
  });

  const startProgressTracking = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        const newProgress = Math.min(prev + (100 / 30), 100); // 30 seconds = 100%
        
        // Auto-complete at 30 seconds
        if (newProgress >= 100 && sessionId && !creditEarned) {
          completeSessionMutation.mutate(sessionId);
        }
        
        return newProgress;
      });
    }, 1000);
  }, [sessionId, creditEarned]);

  const startSession = useCallback(() => {
    if (!sessionId && !creditEarned && enabled) {
      startSessionMutation.mutate();
    }
  }, [sessionId, creditEarned, enabled]);

  const completeSession = useCallback(() => {
    if (sessionId && !creditEarned) {
      completeSessionMutation.mutate(sessionId);
    }
  }, [sessionId, creditEarned]);

  const reset = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    setSessionId(null);
    setProgress(0);
    setCreditEarned(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  return {
    sessionId,
    progress,
    creditEarned,
    startSession,
    completeSession,
    reset,
    isStarting: startSessionMutation.isPending,
    isCompleting: completeSessionMutation.isPending,
  };
}