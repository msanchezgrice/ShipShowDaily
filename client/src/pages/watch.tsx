import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import SimpleVideoPlayer from "@/components/SimpleVideoPlayer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Calendar, ExternalLink, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function Watch() {
  const [, params] = useRoute("/watch/:id");
  const videoId = params?.id;
  const [, navigate] = useLocation();

  // Fetch video details
  const { data: video, isLoading, error } = useQuery({
    queryKey: [`/api/videos/${videoId}`],
    enabled: !!videoId,
    retry: 2,
    staleTime: 0, // Always fetch fresh data
  });

  if (isLoading) {
    return (
      <>
        <Navigation />
        <main className="container max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="bg-gray-300 rounded-lg h-96 mb-4"></div>
            <div className="h-8 bg-gray-300 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-300 rounded w-1/4"></div>
          </div>
        </main>
      </>
    );
  }

  if (error || !video) {
    return (
      <>
        <Navigation />
        <main className="container max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Video not found</h2>
              <p className="text-muted-foreground mb-6">
                This video may have been removed or doesn't exist.
              </p>
              <Button onClick={() => navigate("/feed")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Feed
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  // Ensure video exists before rendering
  if (!video) {
    return null;
  }

  return (
    <>
      <Navigation />
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Video Player */}
        <div className="mb-6">
          {(video?.videoPath || video?.hls_url) ? (
            <SimpleVideoPlayer
              src={video?.hls_url || video?.videoPath}
              poster={video?.thumbnailPath || undefined}
              className="w-full"
            />
          ) : (
            <div className="bg-secondary rounded-lg aspect-video flex items-center justify-center">
              <p className="text-muted-foreground">Video is still processing...</p>
            </div>
          )}
        </div>

        {/* Video Info */}
        <Card>
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold mb-2">{video?.title || 'Untitled'}</h1>
            
            <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
              <span className="flex items-center">
                <Eye className="mr-1 h-4 w-4" />
                {video?.totalViews || 0} views
              </span>
              <span className="flex items-center">
                <Calendar className="mr-1 h-4 w-4" />
                {video?.createdAt ? new Date(video.createdAt).toLocaleDateString() : 'N/A'}
              </span>
              {video?.status === 'processing' && (
                <Badge variant="outline" className="text-yellow-600">
                  Processing
                </Badge>
              )}
            </div>

            {video?.description && (
              <p className="text-foreground mb-6">{video.description}</p>
            )}

            {video?.productUrl && (
              <Button 
                onClick={() => window.open(video.productUrl, '_blank')}
                className="w-full sm:w-auto"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Visit Product
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}